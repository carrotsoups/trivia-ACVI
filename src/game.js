// import the BuzzController class to manage and connect to the controller
import { BuzzController, CONTROLLERS, NAMES } from "./buzz.js";
import { BUZZER } from "./audio.js";

export class Game {
  constructor() {
    // create an instance of the buzz controller and add callbacks
    this.buzzController = new BuzzController();
    this.buzzController.setInputCallback((update) =>
      this.inputCallback(update)
    );
    this.buzzController.setConnectedCallback((update) =>
      this.connectedCallback(update)
    );

    this.buzzer = new Audio(BUZZER);

    // the number of connected controllers
    this.controllers = 0;

    // the page states enum
    this.pageStates = {
      NONE: 0,
      SETUP: 1,
      GAME: 2,
    };

    // the current state
    this.pageState = this.pageStates.NONE;

    this.gameStates = {
      WAITING_NORMAL: 1,
      LOCKED_NORMAL: 2,
      WAITING_A: 3,
      WAITING_B: 4,
      LOCKED_TEAM: 5,
      LOCKED_A: 5,
      LOCKED_B: 6,
      HIGHLIGHT_TEAM: 7,
      HIGHLIGHT_A: 7,
      HIGHLIGHT_B: 8,
      ASSIGNED: 9,
      TEST: 255,
    };

    this.gameState = this.gameStates.NONE;

    this.teams = {
      NONE: -1,
      A: 0,
      B: 1,
    };

    this.currentTeam = this.teams.NONE;
    this.currentController = 0;

    this.score = [0, 0];

    this.setupPage = document.getElementById("setup");
    this.connectedControllers = document.getElementById("connectedControllers");
    this.connectControllerButton = document.getElementById("connectController");
    this.connectControllerButton.addEventListener("click", () =>
      this.buzzController.addDevice()
    );

    this.gamePage = document.getElementById("game");
    this.status = document.getElementById("status");

    this.acceptButton = document.getElementById("main-accept");
    this.acceptButton.addEventListener("click", () => {
      this.accept();
    });
    this.denyButton = document.getElementById("main-deny");
    this.denyButton.addEventListener("click", () => {
      this.deny();
    });

    this.playerNameSelects = document.querySelectorAll(".person-name");
    for (let i = 0; i < this.playerNameSelects.length; i++) {
      this.playerNameSelects[i].addEventListener("click", () => {
        this.nameChange(i);
      });
    }
    this.playerLights = document.querySelectorAll(".person-light");
    this.playerAcceptButtons = document.querySelectorAll(".person-accept");
    for (let i = 0; i < this.playerAcceptButtons.length; i++) {
      this.playerAcceptButtons[i].addEventListener("click", () => {
        this.acceptPlayer(i);
      });
    }
    this.playerDenyButtons = document.querySelectorAll(".person-deny");
    for (let i = 0; i < this.playerDenyButtons.length; i++) {
      this.playerDenyButtons[i].addEventListener("click", () => {
        this.denyPlayer(i);
      });
    }

    this.clearBuzzersButton = document.getElementById("clear-buzzers");
    this.clearBuzzersButton.addEventListener("click", () => {
      this.clear();
      this.setGameState(this.gameStates.WAITING_NORMAL);
    });

    this.normalQuestionButtons = document.getElementById("normal-button");
    this.selectTeamAButton = document.getElementById("team-a-select");
    this.selectTeamAButton.addEventListener("click", () => {
      this.selectTeam(this.teams.A);
    });
    this.selectTeamBButton = document.getElementById("team-b-select");
    this.selectTeamBButton.addEventListener("click", () => {
      this.selectTeam(this.teams.B);
    });
    this.assignedQuestionButton = document.getElementById("assigned-question");
    this.assignedQuestionButton.addEventListener("click", () => {
      this.clear();
      this.setGameState(this.gameStates.ASSIGNED);
    });
    this.addNameButton = document.getElementById("add-name");
    this.addNameButton.addEventListener("click", () => {
      const data = prompt("Please enter a new name:");
      if (!data) return;
      this.appendName(data);
    });
    this.testButton = document.getElementById("test-buzzers");
    this.testButton.addEventListener("click", () => {
      this.clear();
      this.setGameState(this.gameStates.TEST);
    });

    this.assignedQuestionButtons = document.getElementById("assigned-button");
    this.normalQuestionButton = document.getElementById("normal-question");
    this.normalQuestionButton.addEventListener("click", () => {
      this.clear();
      this.setGameState(this.gameStates.WAITING_NORMAL);
    });

    this.scoreIndicators = document.querySelectorAll(".score");
    this.scoreIncrease = document.querySelectorAll(".increase-score");
    for (let i = 0; i < this.scoreIncrease.length; i++) {
      this.scoreIncrease[i].addEventListener("click", () => {
        this.updateScores(i, 10);
      });
    }
    this.scoreDecease = document.querySelectorAll(".decrease-score");
    for (let i = 0; i < this.scoreDecease.length; i++) {
      this.scoreDecease[i].addEventListener("click", () => {
        this.updateScores(i, -10);
      });
    }

    this.scoreReset = document.getElementById("reset-score");
    this.scoreReset.addEventListener("click", () => {
      if(!confirm("Are you sure you want reset?")) return;
      for (let i = 0; i < 2; i++) {
        this.score[i] = 0;
        this.scoreIndicators[i].innerText = 0;
      }
    });

    document.addEventListener("keydown", (event) => {
      switch (event.key.toLowerCase()) {
        case "a":
          this.accept();
          break;
        case "d":
          this.deny();
          break;
        case "c":
          this.clear();
          this.setGameState(this.gameStates.WAITING_NORMAL);
          break;
        case "z":
          this.selectTeam(this.teams.A);
          break;
        case "x":
          this.selectTeam(this.teams.B);
          break;
        case "q":
          if (this.gameState != this.gameStates.ASSIGNED) {
            this.setGameState(this.gameStates.ASSIGNED);
          } else {
            this.setGameState(this.gameStates.WAITING_NORMAL);
          }
          break;
        case "t":
          if (this.gameState != this.gameStates.TEST) {
            this.clear();
            this.setGameState(this.gameStates.TEST);
          } else {
            this.clear();
            this.setGameState(this.gameStates.WAITING_NORMAL);
          }
          break;
      }
    });

    this.setPageState(this.pageStates.SETUP);
    this.setGameState(this.gameStates.WAITING_NORMAL);
  }

  // start the game
  start() {
    return new Promise(async (res, rej) => {
      if (!("hid" in navigator)) {
        alert(
          "Sorry, the WebHID api required to connect to the conrollers is not supported by your browser."
        );
        res(false);
        return;
      }

      // connect to previously connected controllers
      await this.buzzController.connect();

      this.loadNames();

      res(true);
    });
  }

  loadNames() {
    this.names = ["None"];

    const data = localStorage.getItem("name");
    if (data) {
      this.names.push(...JSON.parse(data));
    }

    this.resetNames();
    this.setNames();
  }

  saveNames() {
    localStorage.setItem(
      "name",
      JSON.stringify(this.names.slice(1, this.names.length))
    );
  }

  resetNames() {
    const options = document.querySelectorAll(`.person-option`);
    for (const option of options) {
      option.parentNode.removeChild(option);
    }
  }

  appendName(name) {
    this.names.push(name);

    this.saveNames();

    let option = document.createElement("option");
    option.classList.add(`person-option`);
    option.classList.add(`person-name-${name}`);
    option.value = name;
    option.innerText = name;
    this.appendNameOption(option);
  }

  setNames() {
    for (let i = 0; i < this.names.length; i++) {
      let option = document.createElement("option");
      option.classList.add(`person-option`);
      option.classList.add(`person-name-${this.names[i]}`);
      option.value = this.names[i];
      option.innerText = this.names[i];
      this.appendNameOption(option);
    }
  }

  appendNameOption(option) {
    for (let i = 0; i < this.playerNameSelects.length; i++) {
      this.playerNameSelects[i].appendChild(option.cloneNode(true));
    }
  }

  nameChange(index) {
    let usedNames = [];

    for (let i = 0; i < this.playerNameSelects.length; i++) {
      const value = this.playerNameSelects[i].value;
      if (value != "" && value != "None") {
        usedNames.push(value);
      }
    }

    for (let i = 0; i < this.names.length; i++) {
      const options = document.querySelectorAll(
        `.person-name-${this.names[i]}`
      );
      for (const option of options) {
        option.removeAttribute("disabled");
      }
    }

    for (let i = 0; i < usedNames.length; i++) {
      const options = document.querySelectorAll(`.person-name-${usedNames[i]}`);
      for (const option of options) {
        option.setAttribute("disabled", "true");
      }
    }
  }

  // listen for a button change on the controllers
  inputCallback(update) {
    // loop over the newly pressed buttons
    for (let i = 0; i < update.pressed.length; i++) {
      // get the controller and button index
      const { controller, button, device } = update.pressed[i];

      if (button == 0) {
        if (this.gameState == this.gameStates.WAITING_NORMAL) {
          this.currentTeam = device;
          this.currentController = controller;
          this.setLight(controller, true);
          this.setGameState(this.gameStates.LOCKED_NORMAL);
          this.buzz();
        } else if (
          this.gameState == this.gameStates.WAITING_A &&
          device == this.teams.A
        ) {
          this.currentTeam = device;
          this.currentController = controller;
          this.setLight(controller, true);
          this.setGameState(this.gameStates.LOCKED_A);
          this.buzz();
        } else if (
          this.gameState == this.gameStates.WAITING_B &&
          device == this.teams.B
        ) {
          this.currentTeam = device;
          this.currentController = controller;
          this.setLight(controller, true);
          this.setGameState(this.gameStates.LOCKED_B);
          this.buzz();
        } else if (this.gameState == this.gameStates.TEST) {
          this.setLight(controller, true);
        }
      }
    }

    // loop over the newly released buttons
    for (let i = 0; i < update.released.length; i++) {
      // get the controller and button index
      const { controller, button, device } = update.released[i];

      if (button == 0 && this.gameState == this.gameStates.TEST) {
        this.setLight(controller, false);
      }
    }
  }

  // listen for a new controller connected
  connectedCallback(update) {
    // get the controllers offset or id
    const { offset } = update;

    // increment the controllers connected
    this.controllers++;

    this.connectedControllers.innerText = `There ${
      this.controllers == 1 ? "is" : "are"
    } ${this.controllers} controller${
      this.controllers == 1 ? "" : "s"
    } connected`;

    if (this.controllers == 2 && this.pageState == this.pageStates.SETUP) {
      this.setPageState(this.pageStates.GAME);
    }
  }

  buzz() {
    this.buzzer.pause();
    this.buzzer.currentTime = 0;
    this.buzzer.play();
  }

  accept() {
    if (
      this.gameState == this.gameStates.LOCKED_NORMAL ||
      this.gameState == this.gameStates.LOCKED_A ||
      this.gameState == this.gameStates.LOCKED_B
    ) {
      this.updateScores(this.currentTeam, 10);
      this.setGameState(this.gameStates.WAITING_NORMAL);
      this.setLights(false);
    }
  }

  deny() {
    if (this.gameState == this.gameStates.LOCKED_NORMAL) {
      this.setGameState(
        this.currentTeam == this.teams.A
          ? this.gameStates.WAITING_B
          : this.gameStates.WAITING_A
      );

      this.setLights(false);
    } else if (
      this.gameState == this.gameStates.LOCKED_A ||
      this.gameState == this.gameStates.LOCKED_B
    ) {
      this.setGameState(this.gameStates.WAITING_NORMAL);

      this.setLights(false);
    }
  }

  acceptPlayer(index) {
    this.updateScores(Math.floor(index / 4), 10);
  }

  denyPlayer(index) {
    const player = this.playerNameSelects[index].value;
    if (player == `None`) {
      console.error(
        `An answer was denied, but there was no player assigned to the controller`
      );
      return;
    }
    console.log(`${player} got the assigned question wrong`);
  }

  clear() {
    this.setLights(false);
  }

  selectTeam(team) {
    this.clear();

    if (this.gameState == this.gameStates.HIGHLIGHT_TEAM + team) {
      this.setGameState(this.gameStates.WAITING_NORMAL);
      return;
    }

    this.setGameState(this.gameStates.HIGHLIGHT_TEAM + team);
    this.currentTeam = team;
    this.setTeamLights(team, true);
  }

  updateScores(team, amount) {
    this.score[team] += amount;
    this.scoreIndicators[team].innerText = this.score[team];
  }

  setLight(controller, enabled) {
    try {
      this.buzzController.setLight(controller, enabled);
    } catch (e) {
      console.log(e);
    }

    this.playerLights[controller].style.backgroundColor = enabled
      ? "red"
      : "white";
  }

  setLights(enabled) {
    try {
      this.buzzController.setLights(enabled);
    } catch (e) {
      console.log(e);
    }
    for (let i = 0; i < this.playerLights.length; i++) {
      this.playerLights[i].style.backgroundColor = enabled ? "red" : "white";
    }
  }

  setTeamLights(team, enabled) {
    for (let i = 0; i < CONTROLLERS; i++) {
      try {
        this.buzzController.setLight(team * 4 + i, enabled);
      } catch (e) {
        console.log(e);
      }
      this.playerLights[team * 4 + i].style.backgroundColor = enabled
        ? "red"
        : "white";
    }
  }

  // change the state
  setPageState(state) {
    this.setupPage.style.display = "none";
    this.gamePage.style.display = "none";

    if (state == this.pageStates.SETUP) {
      this.setupPage.style.display = "flex";
    } else if (state == this.pageStates.GAME) {
      this.gamePage.style.display = "flex";
    }

    // save the state for future reference
    this.pageState = state;
  }

  setGameState(state) {
    this.acceptButton.style.display = "none";
    this.denyButton.style.display = "none";

    this.normalQuestionButtons.style.display = "none";
    this.assignedQuestionButtons.style.display = "none";

    for (const acceptButton of this.playerAcceptButtons) {
      acceptButton.style.display = "none";
    }
    for (const denyButton of this.playerDenyButtons) {
      denyButton.style.display = "none";
    }

    if (state == this.gameStates.ASSIGNED) {
      for (const acceptButton of this.playerAcceptButtons) {
        acceptButton.style.display = "flex";
      }
      for (const denyButton of this.playerDenyButtons) {
        denyButton.style.display = "flex";
      }
      this.assignedQuestionButtons.style.display = "flex";
    } else {
      this.acceptButton.style.display = "flex";
      this.denyButton.style.display = "flex";
      this.normalQuestionButtons.style.display = "flex";
    }

    let text = ``;

    switch (state) {
      case this.gameStates.WAITING_NORMAL:
        text = `Waiting for buzzer from any team...`;
        break;
      case this.gameStates.LOCKED_NORMAL: {
        let team = `Team ${this.currentTeam == this.teams.A ? "A" : "B"}`;
        if (this.playerNameSelects[this.currentController].value != "None") {
          team = this.playerNameSelects[this.currentController].value;
        }
        text = `${team} answered.`;
        break;
      }
      case this.gameStates.WAITING_A:
        text = `Waiting for buzzer from Team A...`;
        break;
      case this.gameStates.WAITING_B:
        text = `Waiting for buzzer from Team B...`;
        break;
      case this.gameStates.LOCKED_A: {
        let team = `Team A`;
        if (
          this.currentController < 4 &&
          this.playerNameSelects[this.currentController].value != "None"
        ) {
          team = this.playerNameSelects[this.currentController].value;
        }
        text = `${team} answered after Team B got the answer wrong.`;
        break;
      }
      case this.gameStates.LOCKED_B:
        let team = `Team B`;
        if (
          this.currentController >= 4 &&
          this.playerNameSelects[this.currentController].value != "None"
        ) {
          team = this.playerNameSelects[this.currentController].value;
        }
        text = `${team} answered after Team A got the answer wrong.`;
        break;
      case this.gameStates.HIGHLIGHT_A:
        text = `Selected Team A.`;
        break;
      case this.gameStates.HIGHLIGHT_B:
        text = `Selected Team B.`;
        break;
      case this.gameStates.TEST:
        text = `Testing Mode.`;
        break;
      default:
        break;
    }

    this.status.innerText = text;

    // save the state for future reference
    this.gameState = state;
  }
}
