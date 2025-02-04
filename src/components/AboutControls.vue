
<template>
  <div class='about-controls'>
    <div class='background absolute' @click.prevent='close'></div>
    <div class='content'>
      <h3><a class='title'>Keys for Drawing and Evolution</a></h3>

      <p>
        click the screen before applying any of the following,
        <p></p>
        <a class='title'>Flow</a>
        <p></p>
        'f' - displays flow

        <p></p>
        <a class='title'>Shape ie. Boundary Condition (BC)</a>
        <p></p>

        'w' - displays coded or drawn BC <br>
        'd' - switches between drawing/coding BC (click to draw) <br>
        '1'/'2' - switches between drawing box/ball BC <br>
        <br>
        'Enter' - saves a coded or drawn BC (combining w/ existing) <br>
        'delete' + 'r' - deletes the saved bc <br>
        <br>
        'i'/'o' - switches defining in/out BC (use 'c' to see) <br>
        'r'/'a' - switches defining reach/avoid BC<br>

        <p></p>
        <a class='title'>Momentum & Value</a>
        <p></p>

        'c' - fills BC & value interior <br>
        'l' - displays BC & value levels <br>
        <br>
        'Shift' + 'Enter' - begins the value evolution <br>
        'delete' + 'v' - deletes the value <br>

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
