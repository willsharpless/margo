
<template>
  <div class='about'>
    <div class='background absolute' @click.prevent='close'></div>
    <div class='content'>
      <h3><a class='title'>Margo,</a></h3>
      <p>
        <a clas='highlighted'>is an interactive software for solving level-set evolutions</a> (of Hamilton-Jacobi differential equations).
      </p>
      <p>
        The set is a shape that matches the zero-level of a function, called the energy or value. 
        This energy evolves based on a momentum, called the Hamiltonian. 
      </p>
      <p>
        This shape and momentum are <a clas='highlighted'>your choice</a>; draw or define them.
      </p>
      <p>We often choose the momentum to match a flow (aka vector-field) which models a dynamic system, e.g. jet flight. 
        This is the default definition, thus, <a clas='highlighted'>the shape will move with the flow</a>.
      </p>
      <p>
        The momentum may also be defined with respect to control of the flow so the evolution reveals the best path, 
        e.g. least time & most reward, to a target and the necessary action.
        In fact, solving or learning this evolution is how a modern robot guides itself 
        (so maybe I am not the only one dreaming in shape).
      </p>
      <p>
        I built this because I wanted a faster way to test and discuss new ideas, but also because I wanted to share the beauty of these evolutions. 
      </p>
      <p>
        Find the code and technical details <a href='https://github.com/willsharpless/margo' class='highlighted'> here</a>. Margo is a child of <a href='https://anvaka.github.io/fieldplay' class='highlighted'> Field Play</a>, from which things were added (and broken).
        <a clas='highlighted'>Many thanks</a> to previous developers for the flow visualization &#8212 @anvaka, @mourner, @skeeto &#8212 and HJ-solver &#8212 @ian-mitchell, @schmrlng &#8212 without whom this wouldnt exist.
      </p>
      <p>
        Best, <br>
        <a href='https://willsharpless.github.io/' class='highlighted'>WAS</a>
      </p>
      <a href='#' @click.prevent='close' class='large-close bold'>
        close
      </a>
    </div>
  </div>
</template>

<script>
export default {
  mounted() {
    this.closeHandler = (e) => {
      if (e.keyCode === 27) {
        e.preventDefault();
        this.close();
      }
    }
    document.addEventListener('keyup', this.closeHandler);
  },
  beforeDestroy() {
    document.removeEventListener('keyup', this.closeHandler);
  },
  methods: {
    close() {
      this.$emit('close');
    }
  }
}
</script>
<style lang='stylus'>
@import "./shared.styl";

.about {
  position: absolute;
  overflow-y: auto;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  align-items: flex-start;

  .close {
    position: absolute;
    right: 15px;
    font-size: 12px;
  }
  .large-close {
    width: 100%;
    height: 32px;
    display: block;
    text-align: center;
  }
  .content {
    color: secondary-text;
    position: relative;
    background: window-background;
    top: 50px;
    width: 800px;
    padding: 14px;
    border: 1px solid primary-border;
    h3 {
      margin: 0;
      font-weight: normal;
    }
  }
}
.background {
  position: absolute;
  background-color: hsla(215, 30%, 10%, 0.8);
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
@media (max-width: 800px) {
  .about {
    justify-content: initial;
  }
  .about .content {
    width: 100%;
    border: none;
  }
}
</style>
