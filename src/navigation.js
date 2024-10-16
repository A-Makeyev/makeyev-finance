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
                ${language == 'hebrew' ? 'אין חיבור לרשת' : 'no internet connection'}
            </span>
        `
    }

    if (event.type == 'online') {
        offline.style.display = 'none'
    }
}

function scrollTop() {
    let top = document.documentElement.scrollTop || document.body.scrollTop
    if (top > 0) {
        window.requestAnimationFrame(scrollTop)
        window.scrollTo(0, top - top / 10)
    }
}

function adjustMenuOpen() {
    document.querySelector('#nav-list a')
    logo.classList.remove('logo-image-transparent')
    nav.classList.add('navbar-scrolling')
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
}

function adjustMenuClosed() {
    logo.classList.remove('logo-image')
    nav.classList.remove('navbar-scrolling')
    logo.classList.add('logo-image-transparent')
    nav.style.transition = 'all ease-in-out 0.5s'

    if (window.scrollY > 0) {
        logo.classList.add('logo-image')
        nav.classList.add('navbar-scrolling')
        logo.classList.remove('logo-image-transparent')
    } else {
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

window.addEventListener('online', handleConnectionChange)
window.addEventListener('offline', handleConnectionChange)

// stop scrolling when opening nav menu
menu.onclick = () => {
    if (body.classList.contains('stop-scrolling')) {
        body.classList.remove('stop-scrolling')
        fetchedIndexes && nav.classList.add('adjust-nav')
        setTimeout(() => {
            adjustMenuClosed()
        }, 500)
        menuOpen = false
    } else {
        body.classList.add('stop-scrolling')
        fetchedIndexes && nav.classList.remove('adjust-nav')
        adjustMenuOpen()
        menuOpen = true
    }
}

window.addEventListener('resize', () => {
    // navbar is on TOP on a device with MAX width of 800px
    if (window.matchMedia('(max-width: 800px)').matches && window.scrollY === 0) {
        for (let link = 0; link < navLinks.length; link++) {
            navLinks[link].style.transition = 'all 0.5s'
            navLinks[link].style.color = softBlack
        }

        // navbar is on TOP on a device with MIN width of 800px
    } else if (window.matchMedia('(min-width: 800px)').matches && window.scrollY === 0) {
        for (let link = 0; link < navLinks.length; link++) {
            navLinks[link].style.transition = 'all 0.5s'
            navLinks[link].style.color = softWhite
        }
    }
    menuOpen && menu.click()
})

window.addEventListener('scroll', handleNavBar)
window.addEventListener('DOMContentLoaded', handleNavBar)

function handleNavBar() {
    // navbar scrolling down
    if (window.scrollY > 0) {
        adjustMenuOpen()

        // navbar is on TOP
    } else if (window.scrollY === 0) {
        adjustMenuClosed()
    }
}

// footer
trademark.innerHTML =
    `
    <span>
        makeyev finance © ${currentDateTime('year')}
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
    if (!menuOpen) {
        scrollTop()
    } else {
        menu.click()
    }
}

// display indexes
const timePeriod = `&startPeriod=01-${currentDateTime('year') - 1}&endPeriod=12-${currentDateTime('year')}`
const consumerPriceIndexUrl = `https://api.cbs.gov.il/index/data/price?id=120010&format=xml&download=false${timePeriod}`
const residentialConstructionIndexUrl = `https://api.cbs.gov.il/index/data/price?id=200010&format=xml&download=false${timePeriod}` 
const commercialConstructionIndexUrl = `https://api.cbs.gov.il/index/data/price?id=800010&format=xml&download=false${timePeriod}`
const indexUrls = [consumerPriceIndexUrl, residentialConstructionIndexUrl, commercialConstructionIndexUrl]

function parseXmlToJson(xmlString) {
    const json = {}
    if (xmlString) {
        for (const res of xmlString.matchAll(/(?:<(\w*)(?:\s[^>]*)*>)((?:(?!<\1).)*)(?:<\/\1>)|<(\w*)(?:\s*)*\/>/gm)) {
            const key = res[1] || res[3]
            const value = res[2] && parseXmlToJson(res[2])
            json[key] = ((value && Object.keys(value).length) ? value : res[2]) || null
        }
        return json
    }
}

function getXmlValue(xml, key) {
    return xml.substring(
        xml.lastIndexOf('<' + key + '>') + ('<' + key + '>').length,
        xml.lastIndexOf('</' + key + '>')
    )
}

function adjustMinus(str) {
    if (str.includes('-')) {
        let minus = str.substring(0, 1)
        let value = str.substring(1)
        return value + '%' + minus
    } else {
        return str + '%'
    }
}

indexUrls.forEach(url => {
    fetch(url)
        .then(response => response.text())
        .then(xmlString => {
            const lastYear = parseXmlToJson(xmlString.split('<DateMonth>')[10])
            console.log(lastYear.percentYear)
            const lastMonth = parseXmlToJson(xmlString.split('<DateMonth>')[2])
            const currentMonth = parseXmlToJson(xmlString.split('<DateMonth>')[1])
            const indexName = getXmlValue(xmlString, 'name').replace('- כללי', '').replace('מחירי תשומה', 'תשומה')
            const indexQuery = indexName.split(' ').join('+').substring(0, indexName.length - 1)
            const indexOrder = indexName.includes('צרכן') ? '3' : indexName.includes('מגורים') ? '2' : '1'
            const indexMonthValue = currentMonth.value > lastMonth.value ? '⭡' : currentMonth.value < lastMonth.value ? '⭣' : ''
            const indexMonthColor = currentMonth.value > lastMonth.value ? softRed : currentMonth.value < lastMonth.value ? softGreen : softBlue
            const indexYearValue = currentMonth.percentYear > lastMonth.percentYear ? '⭡' : currentMonth.percentYear < lastMonth.percentYear ? '⭣' : ''
            const indexYearColor = currentMonth.percentYear > lastMonth.percentYear ? softRed : currentMonth.percentYear < lastMonth.percentYear ? softGreen : softBlue
            if (currentMonth) {
                fetchedIndexes = true
                nav.classList.add('adjust-nav')
                indexes.style.display = 'flex'
                indexes.innerHTML +=
                `
                    <a href="https://google.com/search?q=${indexQuery}" target="_blank" style="order: ${indexOrder};">
                        ${indexName} <span style="color: ${indexMonthColor} !important;">${currentMonth.value}</span><span class="line-break"></span>
                        שינוי חודשי <span style="color: ${indexMonthColor} !important;">${indexMonthValue} ${adjustMinus(currentMonth.percent)}</span>
                        שינוי שנתי <span style="color: ${indexYearColor} !important;">${indexYearValue} ${adjustMinus(currentMonth.percentYear)}</span>
                    </a>
                `
            }
        }).catch((error) => {
            console.log(error)
        })
})
