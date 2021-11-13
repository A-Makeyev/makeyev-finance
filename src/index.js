const 

dev = 'http://127.0.0.1:5500/',
prod = 'https://makeyev-finance.netlify.app',
smtpToken = 'f4f02643-1db4-40ed-b666-cb10d6add9d3',
emailFrom = 'makeyev.finance@gmail.com',
emailTo = 'anatoly.makeyev@gmail.com',

// colors
softWhite = 'aliceblue',
softRed = 'rgb(210, 60, 60)',
softBlack = 'rgb(15, 15, 15)',
softGreen = 'rgb(35, 210, 65)',
softBlue = 'rgb(35, 170, 222)',
softGrey = 'rgb(200, 200, 200)',

// loader
body = document.querySelector('body'),
loader = document.getElementById('loader'),
loadingScreen = document.getElementById('loading-screen'),

// navigation
menu = document.getElementById('menu'),
nav = document.getElementById('navbar'),
offline = document.getElementById('offline'),
logo = document.getElementById('logo-image'),
trademark = document.getElementById('trademark'),
navLinks = document.getElementsByClassName('nav-link'),
navMenuLines = document.getElementsByClassName('line'),

// contact
inputName = document.getElementById('name'),
overlay = document.getElementById('overlay'),
inputEmail = document.getElementById('email'),
inputPhone = document.getElementById('phone'),
inputMessage = document.getElementById('message'),
modalUser = document.getElementById('modal-user'),
submitForm = document.getElementById('submit-form'),
contactForm = document.getElementById('contact-form'),
modalHeader = document.querySelector('.modal-header'),
modalBody = document.getElementById('modal-body-text'),
modalTitle = document.getElementById('modal-title-text'),
formInputs = document.getElementsByClassName('form-input'),
modalLinks = document.getElementsByClassName('modal-links'),
openModal = document.querySelectorAll('[data-modal-target]'),
closeModal = document.querySelectorAll('[data-modal-close]')

// functions
function doubleClick(target) {
    let event = new MouseEvent('dblclick', {
        'view': window,
        'bubbles': true,
        'cancelable': true
    })
    target.dispatchEvent(event)
}

function sleep(seconds) {
    let time = new Date().getTime() + (seconds * 1000);
    while (new Date().getTime() <= time) {}
}
