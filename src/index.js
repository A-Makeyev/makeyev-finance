const 

dev = 'http://127.0.0.1:5500/',
prod = 'https://makeyev-finance.netlify.app',
smtpToken = 'f4f02643-1db4-40ed-b666-cb10d6add9d3',
facebookPage = 'https://www.facebook.com/makeyev.finance',
companyMail = 'makeyev.finance@gmail.com',
mainMail = 'anatoly.makeyev@gmail.com',
mainPhone = '+972527729974',

/* links */
whatsAppLink = 'https://wa.me/' + mainPhone.slice(1) + '?text=What%27s%20up%3F',
mailToLink = 'mailto:' + mainMail + '?subject=I%20need%20financial%20advice%21',
wazeLink = 'https://ul.waze.com/ul?place=ChIJKeStYLy2HRURVhdAI9n1TqM&ll=32.81635130%2C35.11280030'
         + '&navigate=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location',

/* colors */
softWhite = 'aliceblue',
softRed = 'rgb(210, 60, 60)',
softBlack = 'rgb(15, 15, 15)',
softGreen = 'rgb(35, 210, 65)',
softBlue = 'rgb(35, 170, 222)',
softGrey = 'rgb(200, 200, 200)',
softYellow = 'rgb(250, 205, 5)',
softOrange = 'rgb(255, 125, 80)',
softDarkBlue = 'rgb(65, 120, 235)',

/* regex */
nameRegex = /^[^0-9.,_!¡?÷?¿/\\+=@#$%ˆ&*(){}|~<>;:[\]]{2,}$/,
phoneRegex = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/,
emailRegex = /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,

/* loader */
body = document.querySelector('body'),
loader = document.getElementById('loader'),
loadingScreen = document.getElementById('loading-screen'),

/* navigation */
menu = document.getElementById('menu'),
nav = document.getElementById('navbar'),
offline = document.getElementById('offline'),
logo = document.getElementById('logo-image'),
icons = document.getElementsByClassName('icon'),
trademark = document.getElementById('trademark'),
navLinks = document.getElementsByClassName('nav-link'),
navMenuLines = document.getElementsByClassName('line'),

/* contact */
action = document.getElementById('action'),
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
actionFormModal = document.querySelector('.form-modal'),
modalTitle = document.getElementById('modal-title-text'),
formInputs = document.getElementsByClassName('form-input'),
formLabels = document.getElementsByClassName('form-label'),
modalLinks = document.getElementsByClassName('modal-links'),
openModal = document.querySelectorAll('[data-modal-target]'),
closeModal = document.querySelectorAll('[data-modal-close]'),

/* locators */
inputXPath = '//*[@class="form-input"]',
labelXPath = '//*[@class="form-label"]'

/* functions */
// find element by xpath
function getXPath(path) {
    return document.evaluate(
        path, document, null,
        XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue
}

// get current date & time
function currentDateTime() {
    let today = new Date()
    let dd = String(today.getDate()).padStart(2, "0")
    let mm = String(today.getMonth() + 1).padStart(2, "0")
    let yyyy = today.getFullYear()
    let minutes = today.getMinutes()
    let hours = today.getHours()
    minutes = minutes < 10 ? `0${minutes}` : minutes
    hours = hours < 10 ? `0${hours}` : hours
    return `${dd}/${mm}/${yyyy} ~ ${hours}:${minutes}`
}

// double click event
function doubleClick(target) {
    let event = new MouseEvent('dblclick', {
        'view': window,
        'bubbles': true,
        'cancelable': true
    })
    target.dispatchEvent(event)
}

// pause thread
function sleep(seconds) {
    let time = new Date().getTime() + (seconds * 1000);
    while (new Date().getTime() <= time) {}
}
