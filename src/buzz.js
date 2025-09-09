// a list of supported buzz controller devices
const DEVICES = [
  {
    // Sony Buzz Controller
    vendorId: 0x054c,
    productId: 0x1000,
  },
  {
    // Sony Buzz Controller
    vendorId: 0x054c,
    productId: 0x0002,
  },
];

// names of the buttons in the order that they appear in the binary input report
export const NAMES = ["red", "yellow", "green", "orange", "blue"];

// how many controllers/buttons per controller each buzz controller has
export const CONTROLLERS = 4;
export const BUTTONS = 5;

// a class to manage receiving input from a buzz controller
export class BuzzController {
  // initialize the class
  constructor() {
    // a callback is used to alert of new input data from the buzz controller
    this.inputCallback = null;
    // a callback to alert of a new connected controller
    this.connectedCallback = null;

    // an array of connected buzz controllers
    this.devices = [];

    // an array of lights
    this.lights = [];
  }

  // set the input callback
  setInputCallback(callback) {
    this.inputCallback = callback;
  }

  // set the connected callback
  setConnectedCallback(callback) {
    this.connectedCallback = callback;
  }

  // connect to a buzz controller
  connect() {
    return new Promise(async (res, rej) => {
      // request a buzz controller devices using the hid class
      const devices = await navigator.hid.getDevices();

      // loop over all the devices
      for (const device of devices) {
        // open the device
        await device.open();

        // setup the device
        this.setupDevice(device);
      }

      // make sure the lights on the new controllers are off
      this.updateLights();

      // resolve a success
      res(true);
    });
  }

  // add a new trusted device
  addDevice() {
    return new Promise(async (res, rej) => {
      // request a buzz controller devices using the hid class
      const [device] = await navigator.hid.requestDevice({
        filters: DEVICES,
      });

      if (!device) res(false);

      // make a connection to the device
      await device.open();

      // setup the device
      this.setupDevice(device);

      // make sure the lights on the new controllers are off
      this.updateLights();

      // resolve a success
      res(true);
    });
  }

  // append a device to the device array and initialize custom fields
  setupDevice(device) {
    // add an event listener to be alerted of new input data
    device.addEventListener("inputreport", (event) => this.inputEvent(event));

    // save the device id for controller number offset
    device.id = this.devices.length;

    // an array to keep track of held buttons to calculate newly pressed and released buttons on an input interrupt
    device.buttons = [];

    // initialize the array
    for (let i = 0; i < CONTROLLERS; i++) {
      // add a light index for each controller
      this.lights.push(false);

      // create a field for each button
      const buttons = [];
      for (let j = 0; j < BUTTONS; j++) {
        buttons.push(false);
      }
      device.buttons.push(buttons);
    }

    // append the device
    this.devices.push(device);

    // create the update data for the callback
    const update = {
      offset: device.id,
      device,
    };

    // send the new data to the callback function (if it was set)
    if (this.connectedCallback != null) this.connectedCallback(update);
  }
  
  setLights(enabled) {
    // turn off all of the lights on all the controllers
    for (let i = 0; i < this.devices.length * CONTROLLERS; i++) {
      // set the index
      this.setLight(i, false);
    }
  }

  // set a light of a controller to enabled
  setLight(controller, enabled) {
    // save the enabled variable in the controller
    this.lights[controller] = enabled;

    // send the lights data to the controllers
    this.updateLights();
  }

  // send the lights data to all of the connected controllers
  updateLights() {
    return new Promise(async (res, rej) => {
      // loop over all of the connected devices
      for (let i = 0; i < this.devices.length; i++) {
        // the start of the packet
        let packet = [0x00];

        // loop over all the buttons
        for (let j = 0; j < BUTTONS; j++) {
          // add the correct byte to the packet
          packet.push(this.lights[j + i * CONTROLLERS] == false ? 0x00 : 0xff);
        }

        // create the binary array
        const buffer = Uint8Array.from(packet);

        // send the packet to the device
        this.devices[i].sendReport(0x00, buffer);
      }

      // resolve a success
      res(true);
    });
  }

  // input data interrupt
  inputEvent(event) {
    // retrive the input data from the event
    const { data, device } = event;

    // controller id offset
    const offset = (device.id ?? -1) * 4;

    // create the result array of newly pressed buttons
    const update = {
      pressed: [],
      released: [],
    };

    // a variable to store the input data as one interger, instead of 3 bytes
    let controllerData = 0;

    // copy the input data bytes in order to the single integer
    for (let i = 0; i < 3; i++) {
      // or the current controller data with the new byte
      controllerData |= data.getUint8(i + 2) << (i * 8);
    }

    // loop over ever controller and button
    for (let i = 0; i < CONTROLLERS * BUTTONS; i++) {
      // calculate the current controller/button index
      let controller = Math.floor(i / BUTTONS);
      let button = i % BUTTONS;

      // check if the current bit is set in the controller data, which means the button is held
      let pressed = ((controllerData >> i) & 1) == 1;

      // if pressed is true, and the button was not held, append the newly pressed button to the pressed array
      if (pressed == true && device.buttons[controller][button] == false) {
        update.pressed.push({ controller: controller + offset, button, device: device.id });
        device.buttons[controller][button] = true;
      }
      // if pressed is false, and the button was held, append the newly released button to the released array
      else if (pressed == false && device.buttons[controller][button] == true) {
        update.released.push({ controller: controller + offset, button, device: device.id });
        device.buttons[controller][button] = false;
      }
    }

    // shuffle the arrays in the event that two buttons are pressed at the exact same time
    this.shuffle(update.pressed);
    this.shuffle(update.released);

    // send the new data to the callback function (if it was set)
    if (this.inputCallback != null) this.inputCallback(update);
  }

  // a function to shuffle an array; https://stackoverflow.com/a/12646864
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
