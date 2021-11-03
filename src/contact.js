const url = location.href
const softRed = 'rgb(210, 60, 60)'
const softGreen = 'rgb(35, 210, 65)'

const popUp = document.querySelector('.popup')
const overlay = document.querySelector('.overlay')
const form = document.getElementById('contact-form')
const statusIcon = document.getElementById('status-icon')
const statusPopup = document.getElementById('status-popup')
const statusMessage = document.getElementById('submit-status')
const statusHeader = document.getElementById('submit-status-header')


form.addEventListener('submit', (event) => {
    event.preventDefault()
  
    let data = new FormData(event.target)
    fetch(event.target.action, {
        method: form.method,
        body: data,
        headers: {
            'Accept': 'application/json'
        }
    }).then(response => {
        statusIcon.innerHTML = '&#129297;'
        statusHeader.innerHTML = 'Your message has been sent!'
        statusMessage.innerHTML = 'We will start saving you money as soon as possible'
        statusIcon.style.fontSize = '50px'
        statusIcon.style.color = softGreen
        statusHeader.style.color = softGreen
        popUp.style.border = `2px solid ${softGreen}`
        statusIcon.style.opacity = '1'
        statusHeader.style.opacity = '1'
        statusMessage.style.opacity = '1'
        
        setTimeout(() => {
            overlay.style.opacity = '0'
            popUp.style.opacity = '0'
            setTimeout(() => {
                overlay.style.display = 'none'
                popUp.style.display = 'none'
                form.reset()
                window.location.href = url
            }, 1000)
        }, 3000)

    }).catch(error => {
        statusIcon.innerHTML = '&#9888;'
        statusHeader.innerHTML = 'Oops!'
        statusMessage.innerHTML = 'There seems to be a problem with your internet connection'
        statusIcon.style.fontSize = '50px'
        statusIcon.style.color = softRed
        statusHeader.style.color = softRed
        popUp.style.border = `2px solid ${softRed}`
        statusIcon.style.opacity = '1'
        statusHeader.style.opacity = '1'
        statusMessage.style.opacity = '1'
        
        setTimeout(() => {
            overlay.style.opacity = '0'
            popUp.style.opacity = '0'
            setTimeout(() => {
                overlay.style.display = 'none'
                popUp.style.display = 'none'
                form.reset()
            }, 1000)
        }, 3000)
    })
})
