// change url's endings to .html on development server
(function setLinks() {
    let url = window.location.href
    let links = document.getElementsByTagName('a')

    if (url.includes(dev)) {
        for (let x = 0; x < links.length; x++) {
            if (links[x].href.includes('services')) links[x].href += '.html'
            if (links[x].href.includes('articles')) links[x].href += '.html'
            if (links[x].href.includes('contact')) links[x].href += '.html'
        }
    } 

    for (let x = 0; x < icons.length; x++) {
        let sibling = icons[x].firstChild.nextSibling
        if (sibling.classList.contains('fa-waze')) icons[x].href = wazeLink
        if (sibling.classList.contains('fa-envelope')) icons[x].href = mailToLink
        if (sibling.classList.contains('fa-whatsapp')) icons[x].href = whatsAppLink
        if (sibling.classList.contains('fa-facebook-square')) icons[x].href = facebookPage
        if (sibling.classList.contains('fa-phone-square-alt')
        || sibling.classList.contains('fa-phone-alt')) {
            icons[x].href = callTo
        } 
    }
})()

// display a message if the user is offline
function handleConnectionChange(event) {
    if (event.type == 'offline') {
        offline.style.display = 'block'
        offline.innerHTML =
        `
            <i class="fas fa-exclamation-circle"></i>
            <span style="margin-left: 5px;">
                no internet connection
            </span>
        `
    }

    if (event.type == 'online') {
        offline.style.display = 'none'
    }
}

window.addEventListener('online', handleConnectionChange)
window.addEventListener('offline', handleConnectionChange)

// stop scrolling when opening nav menu
menu.onclick = () => {
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

window.addEventListener('scroll', handleNavBar)
window.addEventListener('DOMContentLoaded', handleNavBar)

function handleNavBar() {
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
}

// footer
trademark.innerHTML =
`
    <span>
        makeyev finance © ${new Date().getFullYear()}
    </span> 
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

function backToHeader() {
    const scrollTop = () => {
    let top = document.documentElement.scrollTop || document.body.scrollTop
        if (top > 0) {
            window.requestAnimationFrame(scrollTop)
            window.scrollTo(0, top - top / 10)
        }
    }
    scrollTop()
}
