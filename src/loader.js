const loader = document.getElementById('loader')
const loadingScreen = document.getElementById('loading-screen')

document.documentElement.scrollTop = 0

const hidden = document.createElement('style')
hidden.innerHTML = '.hidden { display: none !important; }'
document.getElementsByTagName('head')[0].appendChild(hidden)

function loadMainPage() {
    loadingScreen.style.opacity = '0'
    document.querySelector('body').classList.remove('stop-scrolling')

    setTimeout(() => {
        loadingScreen.classList.add('hidden')
    }, 1000)
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
