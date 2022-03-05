import { Rable } from '../rable.mjs';

const buttonCounter = new Rable({
    data: {
        counter: 0
    }
});

buttonCounter.mount('#button-counter');

const note = new Rable({
    data: {
        notes: [
            "Get some groceries.",
            "Close the issues."
        ],
        newnote: '',
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
});

note.mount('#notes');