// add a button to fill form on dev environment
(function fillForm() {
    if (window.location.href.includes(dev)) {
        let button = document.createElement('button')
        button.setAttribute('id', 'dev-btn')
        button.innerText = 'add test details'
        button.className = 'hero-btn btn-orange'
        document.querySelector('.contact-info').appendChild(button)

        button.addEventListener('click', () => {
            let labels = document.getElementsByClassName('form-label')
            let details = [
                'Estebon Villalon',
                '+972-52-696-9696',
                'villabon@este.lon',
                'Baguette Du Fromage'
            ]

            for (let x = 0; x < labels.length; x++) {
                setTimeout(() => {
                    formInputs[x].focus()
                    formInputs[x].value = details[x]
                }, (x * 750))
            }
            allowSubmit()
        })
    }
})()

// find element by xpath
function getXPath(path) {
    return document.evaluate(
        path, document, null,
        XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue
}

// initialize input fields 
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
            if (getXPath(`(${label})[${x}]`).innerText.slice(-1) !== ':') {
                getXPath(`(${label})[${x}]`).innerText += ':'
            }
        }, 250)
    })

    getXPath(`(${input})[${x}]`).addEventListener('blur', () => {
        let value = getXPath(`(${input})[${x}]`).value
        if (value.length < 1 && value === '') {
            getXPath(`(${input})[${x}]`).style.border = `1px solid ${softBlack}`
            getXPath(`(${label})[${x}]`).style.color = softGrey
            getXPath(`(${label})[${x}]`).style.left = '20px'
            getXPath(`(${label})[${x}]`).style.top = '35px'
            setTimeout(() => { 
                let text = getXPath(`(${label})[${x}]`).innerText.slice(0, -1)
                getXPath(`(${label})[${x}]`).innerText = text
            }, 250)
        }
    })

    getXPath(`(${input})[${x}]`).addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            submitForm.click()
        }
    })
}

// submit form
function validateForm() {
    let validPhone = /^[0-9-+\s]+$/i.test(inputPhone.value)
    let validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail.value)
    let validName = /^[a-zA-Z\u0590-\u05FF ,.'-]+$/i.test(inputName.value)
    
    if (validPhone && validEmail && validName) {
        allowSubmit()
    } else {
        preventSubmit()
    }
}

function allowSubmit() {
    submitForm.disabled = false
    submitForm.style.cursor = 'pointer'
    submitForm.classList.remove('btn-black')
    submitForm.classList.add('btn-blue')
}

function preventSubmit() {
    submitForm.disabled = false
    submitForm.style.cursor = 'pointer'
    submitForm.classList.remove('btn-black')
    submitForm.classList.add('btn-blue')
}

// only clickable after form is validated
submitForm.addEventListener('click', () => {
    setTimeout(() => {
        modal.classList.add('active')
        overlay.classList.add('active')
    }, 750)
})

contactForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    let data = new FormData(event.target)
    fetch(event.target.action, {
        method: contactForm.method,
        body: data,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

    }).then(response => {
        displayModalContent(
            'success',
            'message sent! 🤑',
            'we will get back to you as soon as possible.'
        )
        console.log(response)
        
    }).catch(error => {
        displayModalContent(
            'failure',
            'Oops! ⚠️',
            'There seems to be a problem with your internet connection, reconnect and try again.'
        )
        throw new Error(error)
    })
})

// display modal with a status
function displayModalContent(status, title, body) {
    modalTitle.innerText = title
    modalBody.innerText = body

    if (status === 'success') {
        modalTitle.style.color = softGreen
        modal.style.border = `2px solid ${softGreen}`
        modalHeader.style.borderBottom = `2px solid ${softGreen}`
        modalUser.style.display = 'block'
        modalUser.innerText = `Thanks ${inputName.value},`
        modalLinks[0].style.display = 'block'

    } else if (status === 'failure') {
        modalTitle.style.color = softRed
        modal.style.border = `2px solid ${softRed}`
        modalHeader.style.borderBottom = `2px solid ${softRed}`
        modalUser.style.display = 'none'
        modalLinks[0].style.display = 'none'
    }
}

// close modals when clicking on close modal button
closeModal.forEach(button => {
    button.addEventListener('click', () => {
        let modal = button.closest('.modal')
        if (modal == null) return
        modal.classList.remove('active')
        overlay.classList.remove('active')
        resetForm()
    })
})

// close modals when clicking on overlay
overlay.addEventListener('click', () => {
    const activeModals = document.querySelectorAll('.modal.active')
    activeModals.forEach(modal => {
        if (modal == null) return
        modal.classList.remove('active')
        overlay.classList.remove('active')
        resetForm()
    })
})

// close modal when pressing esc
body.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { 
        document.querySelector('.modal-close').click()
        resetForm()
    }
})

// add form reset when clicking on modal links
for (let x = 0; x < modalLinks[0].children.length; x++) {
    modalLinks[0].children[x].onclick = () => { contactForm.reset() }
}

// reset form and submit button
function resetForm() {
    contactForm.reset()
    submitForm.disabled = true
    submitForm.classList.add('btn-black')
    submitForm.style.cursor = 'not-allowed'
}

// double click
function doubleClick(target) {
    let event = new MouseEvent('dblclick', {
        'view': window,
        'bubbles': true,
        'cancelable': true
    })
    target.dispatchEvent(event)
}

function sleep(seconds) {
    let time = new Date().getTime() + (seconds * 1000);
    while (new Date().getTime() <= time) {}
}
