import { Rable } from '../rable.js';

// GITHUB LINK

const gitlink = new Rable().mount('#repo-link');

// BUTTON COUNTER EXAMPLE.

const buttonCounter = new Rable({
    data: {
        counter: 0
    }
}).mount('#button-counter');

// NOTE TAKING APP.

const note = new Rable({
    data: {
        newnote: '',
        notes: [
            "Hello world!",
            "Get some groceries.",
            "Close the issues."
        ],
        addNote() {
            if (this.newnote !== '') {
                this.notes.push(this.newnote);
                this.newnote = '';
            }
        },
        deleteNote(index) {
            this.notes.splice(index, 1);
        }
    }
}).mount('#notes');

// CLICKS PER SECOND TEST.

const cps = new Rable({
    data: {
        counter: 0,
        running: false,
        listening: true,
        buttonContent: "CPS test",
        buttonClicked: false,
        clickHandler() {
            this.buttonClicked = true;
            const waitUserFinished = () => setTimeout(() => {
                if (this.buttonClicked) {
                    this.buttonClicked = false;
                    waitUserFinished();
                } else {
                    this.listening = true;
                }
            }, 1000);

            if (this.listening) {
                this.running = true;
                this.listening = false;
                setTimeout(() => {
                    this.running = false;
                    this.buttonContent = `${this.counter / 5} CPS!`;
                    this.counter = 0;
                    waitUserFinished();
                }, 5000);
            }

            if (this.running) {
                this.counter++;
                this.buttonContent = this.counter;
            }
        }
    }
}).mount('#cps');

const ifelseifelse = new Rable({
    data: {
        toggleCount: 1,
        togglePlanet: 2,
        clickHandler() {
            if (this.toggleCount == 2) {
                this.toggleCount = 0;
            } else {
                this.toggleCount++;
            }

            if (this.togglePlanet == 2) {
                this.togglePlanet = 0;
            } else {
                this.togglePlanet++;
            }
        }
    }
}).mount('#ifelseifelse');

const attrBind = new Rable({
    data: {
        image: 'https://picsum.photos/600/400',
        async clickHandler() {
            const res = await fetch('https://picsum.photos/600/400');
            this.image = res.url;
        }
    }
}).mount('#attr-bind');

const norender = new Rable({
    data: {
        text: "I will be rendered."
    }
}).mount('#norender');

const components = new Rable({

});

components.importComponent('input-field', '/example/components/Input.html');
components.mount('#components');
