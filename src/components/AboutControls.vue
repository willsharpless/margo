<template>
  <div class='about-controls'>
    <div class='background absolute' @click.prevent='close'></div>
    <div class='content'>
      <h3><a class='title'>Keys</a></h3>

      <p>
        click the screen before applying any of the following,
        <p></p>
        <a class='title'>Flow</a>
        <p></p>
        <span class="code-font">f</span> - displays flow <br>
        <span class="code-font">delete</span> + <span class="code-font">f</span> - deletes the existing flow <br>

        <p></p>
        <a class='title'>Shape ie. Boundary Condition (BC)</a>
        <p></p>

        <span class="code-font">w</span> - displays coded BC <br>
        <!-- <span class="code-font">'w'</span> - displays coded or drawn BC <br> -->
        <!-- <span class="code-font">'d'</span> - switches between drawing/coding BC (click to draw) <br> -->
        <!-- <span class="code-font">'1'/'2'</span> - switches between drawing box/ball BC <br> -->
        <!-- <br> -->
        <!-- <span class="code-font">'Enter'</span> - saves a coded or drawn BC (combining w/ existing) <br> -->
        <!-- <span class="code-font">'delete' + 'r'</span> - deletes the saved bc <br> -->
        <!-- <br> -->
        <span class="code-font">i</span> & <span class="code-font">o</span> - switches defining in/out BC (use <span class="code-font">c</span> to see) <br>
        <!-- <span class="code-font">r</span> & <span class="code-font">a</span> - switches defining reach/avoid BC<br> -->

        <p></p>
        <a class='title'>Momentum & Value</a>
        <p></p>

        <span class="code-font">c</span> - fills BC & value interior <br>
        <span class="code-font">l</span> - displays BC & value levels <br>
        <br>
        <span class="code-font">enter</span> - begins the value evolution <br>
        <span class="code-font">delete</span> + <span class="code-font">v</span> - deletes the existing value <br>

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

.about-controls {
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
    top: 100px;
    width: 600px;
    padding: 14px;
    border: 1px solid primary-border;
    h3 {
      margin: 0;
      font-weight: normal;
    }
  }
}

/* New style for code-font */
.code-font {
  font-family: monospace;
  background-color: #1e1e1e; /* Dark background */
  color: #ff6b6b; /* Soft red/pink text */
  padding: 2px 5px; /* More padding for spacing */
  border-radius: 6px; /* Rounded edges */
  font-size: 1em; /* Slightly smaller font */
  display: inline-block; /* Keeps formatting clean */
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
  .about-controls {
    justify-content: initial;
  }
  .about-controls .content {
    width: 100%;
    border: none;
  }
}
</style>
