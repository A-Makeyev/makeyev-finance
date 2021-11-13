// add a button to fill form on dev environment
(function fillForm() {
    if (window.location.href.includes(dev)) {
        let button = document.createElement('button')
        button.setAttribute('id', 'dev-btn')
        button.textContent = 'add test details'
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

            if (window.navigator.onLine) {
                offline.style.display = 'block'
                offline.textContent = `<h1>Dear ${inputName.value}, you are offline</h1>`
            }
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
            if (getXPath(`(${label})[${x}]`).textContent.slice(-1) !== ':') {
                getXPath(`(${label})[${x}]`).textContent += ':'
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
                let text = getXPath(`(${label})[${x}]`).textContent.slice(0, -1)
                getXPath(`(${label})[${x}]`).textContent = text
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
    const validPhone = /^[0-9-+\s]+$/i.test(inputPhone.value)
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail.value)
    const validName = /^[a-zA-Z\u0590-\u05FF ,.'-]+$/i.test(inputName.value)
    
    inputPhone.onchange = () => {
        if (!validPhone) {
            inputPhone.style.borderColor = softRed
        }
    }

    inputEmail.onchange = () => {
        if (!validEmail) {
            inputEmail.style.borderColor = softRed
        }
    }

    inputName.onchange = () => {
        if (!validName) {
            inputName.style.borderColor = softRed
        }
    }
    
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

contactForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    preventSubmit()
    submitForm.textContent = 'Sending...'
    submitForm.style.pointerEvents = 'none'
    
    function createEmailBody() {
        let name = inputName.value
        let phone = inputPhone.value
        let email = inputEmail.value
        let message = inputMessage.value

        return 
        `
            <h1>${inputName.value}</h1>
        `
    }

    if (window.navigator.onLine) {
        Email.send({
            // enable less secure apps
            // https://myaccount.google.com/lesssecureapps
            SecureToken: smtpToken,
            To: emailTo,
            From: emailFrom,
            Subject: 'New Customer 🤑',
            Body: createEmailBody()
            
        }).then(response => {
            displayModalContent(
                'success',
                'message sent! 🤑',
                'we will get back to you as soon as possible.'
            )
            allowSubmit()
            submitForm.textContent = 'Send'
            submitForm.style.pointerEvents = 'all'
            console.log(response)
    
        }).catch(error => {
            throw new Error(error)
        })

    } else {
        // user is offline
        displayModalContent(
            'failure',
            'Oops! ⚠️',
            'There seems to be a problem with your internet connection, reconnect and try again.'
        )
        allowSubmit()
        submitForm.textContent = 'Send'
        submitForm.style.pointerEvents = 'all'

        offline.style.display = 'block'
        offline.textContent = `<h1>Dear ${inputName.value}, you are offline</h1>`

    }
    return false
})

// display modal with a status
function displayModalContent(status, title, body) {
    modalTitle.textContent = title
    modalBody.textContent = body

    if (status === 'success') {
        modalTitle.style.color = softGreen
        modal.style.border = `2px solid ${softGreen}`
        modalHeader.style.borderBottom = `2px solid ${softGreen}`
        modalUser.style.display = 'block'
        modalUser.textContent = `Thanks ${inputName.value},`
        modalLinks[0].style.display = 'block'

    } else if (status === 'failure') {
        modalTitle.style.color = softRed
        modal.style.border = `2px solid ${softRed}`
        modalHeader.style.borderBottom = `2px solid ${softRed}`
        modalUser.style.display = 'none'
        modalLinks[0].style.display = 'none'
    }

    modal.classList.add('active')
    overlay.classList.add('active')
}

// close modals when clicking on close modal button
closeModal.forEach(button => {
    button.addEventListener('click', () => {
        let modal = button.closest('.modal')
        if (modal == null) return
        modal.classList.remove('active')
        overlay.classList.remove('active')
        contactForm.reset()
    })
})

// close modals when clicking on overlay
overlay.addEventListener('click', () => {
    const activeModals = document.querySelectorAll('.modal.active')
    activeModals.forEach(modal => {
        if (modal == null) return
        modal.classList.remove('active')
        overlay.classList.remove('active')
        contactForm.reset()
    })
})

// close modal when pressing esc
body.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { 
        document.querySelector('.modal-close').click()
        contactForm.reset()
    }
})

// add form reset when clicking on modal links
for (let x = 0; x < modalLinks[0].children.length; x++) {
    modalLinks[0].children[x].onclick = () => { contactForm.reset() }
}
