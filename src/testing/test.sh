
# This is the frame (Time) at which the values of the evolution are saved. 
# If a large frame is used, ie 2000, increase the sleep time to 10 seconds between shift+enter and moving the file
FRAME=1000
# Tests are going from 1 to 3, where 1 is default, 2 is wide and 3 is spiral
TEST=1

case "$TEST" in
  1)
    NPM_CMD="npm run dev"
    ;;
  2)
    NPM_CMD="npm run dev:wide"
    ;;
  3)
    NPM_CMD="npm run dev:spiral"
    ;;
  *)
    echo "Invalid TEST value: $TEST; must be 1, 2 or 3"
    exit 1
    ;;
esac



# Run the dev server properly in the background with environment variable
VITE_MY_INT_ARG=$FRAME nohup $NPM_CMD > /tmp/devserver.log 2>&1 &

# Capture the PID
NPM_PID=$!

# Ensure cleanup on exit
cleanup() {
  echo "Cleaning up..."
  kill -- -$NPM_PID 2>/dev/null
  wait $NPM_PID 2>/dev/null
}
trap cleanup EXIT INT TERM

# Wait for server to start
sleep 5

# Reload Chrome active tab
echo "Reloading Chrome active tab…"
chrome-cli reload
echo "Reloaded Chrome active tab."

sleep 5

osascript <<EOF
tell application "Google Chrome" to activate
delay 0.3
tell application "System Events"
    keystroke return using {shift down}
end tell
EOF
echo "Shift Enter Clicked"


sleep 10

FILENAME="value_texture_0.csv"

# Define source path in Downloads (change if needed)
SOURCE="$HOME/Downloads/$FILENAME"

# Get the directory where this script is located
DEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Move the file
if [ -f "$SOURCE" ]; then
  mv "$SOURCE" "$DEST_DIR/"
  echo "Moved $FILENAME to $DEST_DIR"

  #echo "Terminating React dev server (PID $NPM_PID)..."
  #if kill -- -$NPM_PID 2>/dev/null; then
   # echo "React server terminated."

else
  echo "File $FILENAME not found in Downloads"
  exit 1;
fi

python margoUnitTest.py $FRAME $TEST

#wait $NPM_PID

