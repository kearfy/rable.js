import { Rable } from '../rable.mjs';

const buttonCounter = new Rable({
    data: {
        counter: 0
    }
});

buttonCounter.mount('#button-counter');

const note = new Rable({
    data: {
        notes: [],
        newnote: ''
    }
});

note.mount('#notes');