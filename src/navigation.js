const softWhite = 'aliceblue'
const softBlack = 'rgb(15, 15, 15)'
const solftBlue = 'rgb(35, 170, 222)'

const menu = document.getElementById('menu')
const nav = document.getElementById('navbar')
const logo = document.getElementById('logo-image')
const trademark = document.getElementById('trademark')
const navLinks = document.getElementsByClassName('nav-link')
const navMenuLines = document.getElementsByClassName('line')

menu.onclick = () => {
    let body = document.querySelector('body')
    body.classList.contains('stop-scrolling') 
    ? body.classList.remove('stop-scrolling')
    : body.classList.add('stop-scrolling')
}

window.addEventListener('resize', () => {
    // navbar is on TOP on a device with MAX width of 770px
    if (window.matchMedia('(max-width: 770px)').matches && window.scrollY === 0) {
        for (let link = 0; link < navLinks.length; link++) {
            navLinks[link].style.transition = 'all 0.5s'
            navLinks[link].style.color = softBlack
        }

    // navbar is on TOP on a device with MIN width of 770px
    } else if (window.matchMedia('(min-width: 770px)').matches && window.scrollY === 0) {
        for (let link = 0; link < navLinks.length; link++) {
            navLinks[link].style.transition = 'all 0.5s'
            navLinks[link].style.color = softWhite
        }
    }
})

window.addEventListener('scroll', () => {
    // navbar scrolling down
    if (window.scrollY > 0) {
        nav.classList.add('navbar-scrolling')
        logo.classList.remove('logo-image-transparent')
        logo.classList.add('logo-image')

        for (let link = 0; link < navLinks.length; link++) {
            navLinks[link].style.transition = 'all 0.5s'
            navLinks[link].style.color = softBlack
        }

        for (let line = 0; line < navMenuLines.length; line++) {
            navMenuLines[line].style.backgroundColor = softBlack
        }

        // navbar scrolling down on a device with MIN width of 770px
        if (window.matchMedia('(min-width: 770px)').matches) {
            nav.classList.add('nav-scrolling-resize')
            logo.style.width = '20%'
        }

    // navbar is on TOP
    } else if (window.scrollY === 0) {
        nav.classList.remove('navbar-scrolling')
        logo.classList.remove('logo-image')
        logo.classList.add('logo-image-transparent')

        if (window.matchMedia('(min-width: 770px)').matches && window.scrollY === 0) {
            nav.classList.remove('nav-scrolling-resize')
            logo.style.width = '30%'
        }

        // navbar is on TOP on a device with MAX width of 770px
        if (window.matchMedia('(max-width: 770px)').matches && window.scrollY === 0) {
            for (let link = 0; link < navLinks.length; link++) {
                navLinks[link].style.transition = 'all 0.5s'
                navLinks[link].style.color = softBlack
            }

        // navbar is on top on a device with MIN width of 770px
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

trademark.innerHTML =
 `
    <div style="margin-bottom: -15px;">
        <span>makeyev finance © ${new Date().getFullYear()}</span> 
        <div style="margin-top: 10px;">
            <a class="footer-link" href="/">home</a>
            <span>&#183;</span>
            <a class="footer-link" href="services">services</a>
            <span>&#183;</span>
            <a class="footer-link" href="articles">articles</a>
            <span>&#183;</span>
            <a class="footer-link" href="contact">contact</a>
        </div>
    </div>
`

var footerLinks = document.createElement('style')
var footerLinksHover = document.createElement('style')

footerLinks.innerHTML = 
`
    .footer-link { 
        text-transform: capitalize;
        color: var(--soft-white);
        transition: 0.5s; 
    }

`

footerLinksHover.innerHTML = 
`
    .footer-link:hover { 
        color: var(--soft-blue); 
    }

`

document.getElementsByTagName('head')[0].appendChild(footerLinks)
document.getElementsByTagName('head')[0].appendChild(footerLinksHover)
