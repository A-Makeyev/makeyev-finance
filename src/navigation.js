const softWhite = 'aliceblue'
const softBlack = 'rgb(15, 15, 15)'
const solftBlue = 'rgb(35, 170, 222)'
const nav = document.getElementById('navbar')
const logo = document.querySelector('.logo-image')
const navLinksMenu = document.getElementById('#nav-links')
const navLinks = document.getElementsByClassName('nav-link')
const navMenuLines = document.getElementsByClassName('line')

window.addEventListener('resize', () => {
    if (window.matchMedia('(max-width: 770px)').matches && window.scrollY === 0) {
        for (let link = 0; link < navLinks.length; link++) {
            navLinks[link].style.transition = 'all 0.5s'
            navLinks[link].style.color = softBlack
        }
    } else if (window.matchMedia('(min-width: 770px)').matches && window.scrollY === 0) {
        for (let link = 0; link < navLinks.length; link++) {
            navLinks[link].style.transition = 'all 0.5s'
            navLinks[link].style.color = softWhite
        }
    }
})

window.addEventListener('scroll', () => {
    if (window.scrollY > 0) {
        nav.classList.add('navbar-scrolling')
        logo.style.content = 'url(/images/Logo.png)'

        for (let link = 0; link < navLinks.length; link++) {
            navLinks[link].style.transition = 'all 0.5s'
            navLinks[link].style.color = softBlack
        }
        for (let line = 0; line < navMenuLines.length; line++) {
            navMenuLines[line].style.backgroundColor = softBlack
        }
    } else if (window.scrollY === 0) {
        nav.classList.remove('navbar-scrolling')
        logo.style.content = 'url(/images/Logo-T.png)'

        if (window.matchMedia('(max-width: 770px)').matches && window.scrollY === 0) {
            for (let link = 0; link < navLinks.length; link++) {
                navLinks[link].style.transition = 'all 0.5s'
                navLinks[link].style.color = softBlack
            }
        } else {
            for (let link = 0; link < navLinks.length; link++) {
                navLinks[link].style.transition = 'all 0.5s'
                navLinks[link].style.color = softWhite
            }
        }
        for (let line = 0; line < navMenuLines.length; line++) {
            navMenuLines[line].style.backgroundColor = softWhite
        }
    }
})
