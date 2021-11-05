const url = window.location.href

function getXPath(path) {
    return document.evaluate(
        path, document, null,
        XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue
}

// lift labels
const inputs = document.getElementsByClassName('form-input').length

for (let x = 1; x <= inputs; x++) {
    let input = '//*[@class="form-input"]'
    let label = '//*[@class="form-label"]'

    getXPath(`(${input})[${x}]`).addEventListener('focus', () => {
        getXPath(`(${input})[${x}]`).style.border = `2px solid ${softBlue}`
        getXPath(`(${label})[${x}]`).style.color = softBlue
        getXPath(`(${label})[${x}]`).style.left = '0'
        getXPath(`(${label})[${x}]`).style.top = '0'
        setTimeout(() => { 
            getXPath(`(${label})[${x}]`).innerHTML += ':'
        }, 250)
    })

    getXPath(`(${input})[${x}]`).addEventListener('blur', () => {
        getXPath(`(${input})[${x}]`).style.border = `1px solid ${softBlack}`
        getXPath(`(${label})[${x}]`).style.color = softGrey
        getXPath(`(${label})[${x}]`).style.left = '20px'
        getXPath(`(${label})[${x}]`).style.top = '35px'
        setTimeout(() => { 
            let text = getXPath(`(${label})[${x}]`).innerText.slice(0, -1)
            getXPath(`(${label})[${x}]`).innerText = text
        }, 250)
    })
}

// submit form
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
        statusHeader.innerHTML = 'Message has been sent!'
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

