document.documentElement.scrollTop = 0

function loadMainPage() {
    if (window.location.href.includes('/?fbclid=')) window.location.replace('/')
    
    loadingScreen.style.opacity = '0'
    document.querySelector('body').classList.remove('stop-scrolling')

    setTimeout(() => {
        loadingScreen.classList.add('hidden')
    }, 1000)

    const observer = new IntersectionObserver((enteries) => {
        enteries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('faded-in')
            } // else { entry.target.classList.remove('faded-in') }
        })
    })
    
    const elementsToFade = document.querySelectorAll('.fade-in')
    elementsToFade.forEach((element) => {
        observer.observe(element)
    })
}

if (window.attachEvent) {
    window.addEventListener('load', loadMainPage)
} else {
    if (window.onload) {
        var curronload = window.onload
        var newonload = (event) => {
            curronload(event)
            loadMainPage()
        }
        window.onload = newonload
    } else {
        window.onload = loadMainPage
    }
}
