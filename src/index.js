const 

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
logo = document.getElementById('logo-image'),
trademark = document.getElementById('trademark'),
navLinks = document.getElementsByClassName('nav-link'),
navMenuLines = document.getElementsByClassName('line'),

// contact
inputName = document.getElementById('name'),
overlay = document.getElementById('overlay'),
inputEmail = document.getElementById('email'),
inputPhone = document.getElementById('phone'),
form = document.getElementById('contact-form'),
inputMessage = document.getElementById('message'),
modalUser = document.getElementById('modal-user'),
submitForm = document.getElementById('submit-form'),
modalHeader = document.querySelector('.modal-header'),
modalBody = document.getElementById('modal-body-text'),
modalTitle = document.getElementById('modal-title-text'),
modalLinks = document.getElementsByClassName('modal-links'),
openModal = document.querySelectorAll('[data-modal-target]'),
closeModal = document.querySelectorAll('[data-modal-close]')
