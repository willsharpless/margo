print("Hello from margoUnitTest.py")

import sys
import jax
import jax.numpy as jnp
import numpy as np

from IPython.display import HTML
import matplotlib.animation as anim
import matplotlib.pyplot as plt
import plotly.graph_objects as go

import hj_reachability as hj

time = sys.argv[1]
time = int(time)

test = sys.argv[2]
preset_map = {
    '2': 'wide',
    '3': 'spiral',
    '1': 'default'
}
preset = preset_map.get(test, 'default')



class CustomFlow(hj.ControlAndDisturbanceAffineDynamics):
    def __init__(self,
                 preset: str = 'default',
                 flipped=False,
                 u_bd=1.,
                 d_bd=1.,
                 control_mode="max",
                 disturbance_mode="min",
                 control_space=None,
                 disturbance_space=None):
        self.flipped = flipped
        self.preset = preset

        if control_space is None:
            control_space = hj.sets.Box(jnp.array([-u_bd]), jnp.array([u_bd]))
        if disturbance_space is None:
            disturbance_space = hj.sets.Box(jnp.array([-d_bd]), jnp.array([d_bd]))
        super().__init__(control_mode, disturbance_mode, control_space, disturbance_space)

    def open_loop_dynamics(self, state, t):
        x = state[..., 0]
        y = state[..., 1]

        if self.preset == 'wide':
            # inward (negated wide)
            v_x = -4. * x
            v_y = -4. * y

        elif self.preset == 'spiral':
            # spiral
            v_x =  4. * -y
            v_y =  4. *  x

        else:
            # default
            v_x = 2. * x * y
            v_y = y**2 - x**2

        return jnp.stack([v_x, v_y], axis=-1)
    
    def control_jacobian(self, state, time):
        return jnp.array([
            [0.],
            [0.],
        ])

    def disturbance_jacobian(self, state, time):
        return jnp.array([
            [0.],
            [0.],
        ])
    
    def ham(self, grid, values, solver_settings):
        """Computes the Hamiltonian at each grid point."""
        left_grad_values, right_grad_values = grid.upwind_grad_values(solver_settings.upwind_scheme, values)
        avg_grad_values = (left_grad_values + right_grad_values) / 2  # Compute central gradient approximation
        
        # Compute Hamiltonian H = ∇V · f(x, y)
        hamiltonian_values = jnp.einsum("...i,...i->...", avg_grad_values, self.open_loop_dynamics(grid.states, 0.))

        print("\nHamiltonian Values at Grid Points:")
        print(hamiltonian_values[:5, :5])  # Print small portion for debugging

        return hamiltonian_values
    
import pandas as pd
import numpy as np

# Load CSV
df = pd.read_csv('value_texture_0 (91).csv')


# Extract unique values sorted (this assumes the grid is regular)
unique_x = np.sort(df['x'].unique())
unique_y = np.sort(df['y'].unique())

# Define the grid boundaries
lower_bound = np.array([unique_x[0], unique_y[0]])
upper_bound = np.array([unique_x[-1], unique_y[-1]])

# Determine the number of points in each direction
nx = unique_x.size
ny = unique_y.size

dynamics = CustomFlow(preset=preset)
grid = hj.Grid.from_lattice_parameters_and_boundary_conditions(
    hj.sets.Box(lower_bound, upper_bound),
    (nx, ny)
)
values = jnp.maximum(jnp.abs(grid.states[..., 0]), jnp.abs(grid.states[..., 1])) - 0.5

solver_settings = hj.SolverSettings.with_accuracy("very_high",
                                                  hamiltonian_postprocessor=hj.solver.backwards_reachable_tube)

initial_time = 0.0
target_time = -(time*0.0005*2)  #Time Step is 0.0005, so frame * 0.0005 * 2 = time of logging
target_values = hj.step(solver_settings, dynamics, grid, initial_time, values, target_time)

import pandas as pd
from scipy.spatial import cKDTree

#Loading CSV file into pandas data frame
df = pd.read_csv("value_texture_0.csv")


grid_x, grid_y = np.meshgrid(grid.coordinate_vectors[0], grid.coordinate_vectors[1], indexing="ij")
grid_points = np.column_stack((grid_x.ravel(), grid_y.ravel()))
target_values_flat = target_values[:, :].T.ravel()



tree = cKDTree(grid_points)
query_points = df[['x', 'y']].to_numpy()
distances, indices = tree.query(query_points)


matched_target_values = target_values_flat[indices]

mse_values = np.mean((df['value'].to_numpy() - matched_target_values) ** 2)
print(f"\nMean Squared Error (MSE) of values: {mse_values:.10f}")

# Compute Mean Squared Error (MSE) of distances
mse_distances = np.mean(distances ** 2)
print(f"Mean Squared Error (MSE) of distances: {mse_distances:.10f}")

# Compute total distance between CSV points and nearest grid points
total_distance = np.sum(distances)
print(f"Total distance: {total_distance:.10f}")


logfile = "hj_results.log"
with open(logfile, "a") as f:
    # fields: frame, test, mse_values, mse_distances, total_distance
    f.write(f"{time},{test},{mse_values:.10f},{mse_distances:.10f},{total_distance:.10f}\n")
