const
menuOpen = false,
language = 'hebrew',
dev = 'http://127.0.0.1:5500',
prod = 'https://makeyev-finance.netlify.app',
smtpToken = '88263185-689f-4f54-8491-33a2ba3a1a48',
facebookPage = 'https://www.facebook.com/makeyev.finance',
companyMail = 'makeyev.finance@gmail.com',
mainAddress = 'Florentin 23 Tel Aviv',
mainEmail = 'anatoly.makeyev@gmail.com',
mainPhone = '0527729974',

/* links */
callTo = 'tel:' + mainPhone,
mailToLink = 'mailto:' + mainEmail + '?subject=I%20need%20financial%20advice%21',
whatsAppLink = 'https://wa.me/' + mainPhone.replace(mainPhone.charAt(0), '972') + '?text=What%27s%20up%3F',
wazeMap = `https://embed.waze.com/${language == 'hebrew' ? 'he' : ''}` + '/iframe?zoom=16&lat=32.056323&lon=34.769313&ct=livemap',
wazeLink = 'https://ul.waze.com/ul?place=ChIJp9fIOZ9MHRURg5L4vD_YK1c&ll=32.05632250%2C34.76931260&navigate=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location',
googleMap = 'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d27051.822489683218!2d34.76055827048644!3d32.05632299999998!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x151d4c9f39c8d7a7%3A0x572bd83fbcf89283!2sFlorentin%20St%2023%2C%20Tel%20Aviv-Yafo!5e0!3m2!1sen!2sil!4v1662889337932!5m2!1sen!2sil',

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
currentDateTime = (type) => {
    let today = new Date()
	let	day = String(today.getDate()).padStart(2, "0")
	let	month = String(today.getMonth() + 1).padStart(2, "0")
	let	year = today.getFullYear()
    let	hours = today.getHours()
    let	minutes = today.getMinutes()
    
	hours = hours < 10 ? `0${hours}` : hours
	minutes = minutes < 10 ? `0${minutes}` : minutes

    switch (type) {
        case 'day':
            return day
        case 'month':
            return month
        case 'year':
            return year
        case 'hours':
            return hours 
        case 'minutes':
            return minutes
        default:
            return `${day}/${month}/${year} ~ ${hours}:${minutes}`
    }
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
