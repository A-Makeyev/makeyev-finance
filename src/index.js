var 

// TODO 
// add changing language to english

menuOpen = false,
language = 'hebrew',
dev = 'http://127.0.0.1:5500',
prod = 'https://makeyev-finance.netlify.app',
smtpToken = '88263185-689f-4f54-8491-33a2ba3a1a48',
facebookPage = 'https://www.facebook.com/makeyev.finance',
companyMail = 'makeyev.finance@gmail.com',
mainAddress = 'Sde Boker 39 Kiryat Ata',
mainEmail = 'anatoly.makeyev@gmail.com',
mainPhone = '0527729974',

/* links */
callTo = 'tel:' + mainPhone,
whatsAppLink = 'https://wa.me/' + mainPhone.replace(mainPhone.charAt(0), '972') + '?text=What%27s%20up%3F',
mailToLink = 'mailto:' + mainEmail + '?subject=I%20need%20financial%20advice%21',
wazeLink = 'https://ul.waze.com/'
         + '/ul?place=ChIJKeStYLy2HRURVhdAI9n1TqM&ll=32.81635130%2C35.11280030'
         + '&navigate=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location',

wazeMap = `https://embed.waze.com/${language == 'hebrew' ? 'he' : ''}` + '/iframe?zoom=12&lat=32.816351&lon=35.112800&ct=livemap&pin=1&desc=1&navigate=yes',
googleMap = 'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d53653.290380525286!2d35.118637!3d32.810003!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x151db6bc60ade429%3A0xa34ef5d923401756!2sSde%20Boker%20St%2039%2C%20Kiryat%20Ata!5e0!3m2!1sen!2sil!4v1640391156734!5m2!1sen!2sil',

/* regex */
phoneRegex = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/,
nameRegex = /^[^0-9.,_!¡?÷?¿/\\+=@#$%ˆ&*(){}|~<>;:[\]]{2,}$/,
emailRegex = /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),

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
map = document.getElementById('map'),
action = document.getElementById('action'),
inputName = document.getElementById('name'),
overlay = document.getElementById('overlay'),
inputEmail = document.getElementById('email'),
inputPhone = document.getElementById('phone'),
messageModal = document.querySelector('.modal'),
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
wazeAddresses = document.getElementsByClassName('wazeAddress'),

// get current date & time
currentDateTime = () => {
    let today = new Date()
	let	dd = String(today.getDate()).padStart(2, "0")
	let	mm = String(today.getMonth() + 1).padStart(2, "0")
	let	yyyy = today.getFullYear()
    let	hours = today.getHours()
    let	minutes = today.getMinutes()
	hours = hours < 10 ? `0${hours}` : hours
	minutes = minutes < 10 ? `0${minutes}` : minutes
    return `${dd}/${mm}/${yyyy} ~ ${hours}:${minutes}`
}

// double click event
doubleClick = (target) => {
    let event = new MouseEvent('dblclick', {
        'view': window,
        'bubbles': true,
        'cancelable': true
    })
    target.dispatchEvent(event)
}

//
randomPhone = () => {
    return String('052' + Math.random().toString().slice(2, 9)) 
}

randomEmail = () => {
    let domains = ['gmail', 'hotmail', 'yahoo', 'live']
    let names = ['tolik', 'macaroni', 'estabonbon', 'woody']
    return names[Math.floor(Math.random() * domains.length)]
    + '@' + domains[Math.floor(Math.random() * domains.length)] + '.com' 
}

randomName = () => {
    let names = language == 'hebrew'  
    ? ['פראנק וודס', 'אסטבון ויללון', 'רוני מיכאל', 'אנטולי מקייב']
    : ['Anatoly Makeyev', 'Roni Michael', 'Estabon Villalon', 'Frank Woods']
    let random = (min, max) => { return Math.floor(Math.random() * (max - min)) + min }
    return names[random(0, names.length)]
}

function log(message, color) {
    console.log(`%c${message}`, `color: ${color};`)
}

// pause thread
sleep = (seconds) => {
    let time = new Date().getTime() + (seconds * 1000);
    while (new Date().getTime() <= time) {}
}

// console.log(JSON.stringify({
//     isAndroid: /Android/.test(navigator.userAgent),
//     isCordova: !!window.cordova,
//     isEdge: /Edge/.test(navigator.userAgent),
//     isFirefox: /Firefox/.test(navigator.userAgent),
//     isChrome: /Google Inc/.test(navigator.vendor),
//     isChromeIOS: /CriOS/.test(navigator.userAgent),
//     isChromiumBased: !!window.chrome && !/Edge/.test(navigator.userAgent),
//     isIE: /Trident/.test(navigator.userAgent),
//     isIOS: /(iPhone|iPad|iPod)/.test(navigator.platform),
//     isOpera: /OPR/.test(navigator.userAgent),
//     isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
//     isTouchScreen: ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch,
//     isWebComponentsSupported: 'registerElement' in document && 'import' in document.createElement('link') && 'content' in document.createElement('template')
//   }, null, ' '))
