// add a button to fill form on dev environment
(function fillForm() {
    if (window.location.href.includes(dev)) {
        let button = document.createElement('button')
        button.setAttribute('id', 'dev-btn')
        button.textContent = 'add test details'
        button.className = 'hero-btn btn-orange'
        button.style.marginLeft = '10px'
        contactForm.appendChild(button)

        button.addEventListener('click', () => {
            let labels = document.getElementsByClassName('form-label')
            let details = [
                'Estebon Villalon',
                '+972-52-696-9696',
                'villabon@este.lon',
                'Baguette Du Fromage '
            ]

            for (let x = 0; x < labels.length; x++) {
                setTimeout(() => {
                    if (x == 3) details[x] = details[x].repeat(16)
                    formInputs[x].focus()
                    formInputs[x].value = details[x]
                }, (x * 500))
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
    submitForm.textContent = 'sending.. '
    submitForm.innerHTML += '<i class="fas fa-paper-plane"></i>'
    submitForm.style.pointerEvents = 'none'
    
    if (window.navigator.onLine) {
        Email.send({
            // enable less secure apps
            // https://myaccount.google.com/lesssecureapps
            SecureToken: smtpToken,
            To: emailTo,
            From: emailFrom,
            Subject: 'New Customer 🤩',
            Body: createEmailBody()
            
        }).then(response => {
            displayModalContent(
                'success',
                'message sent! 🤑',
                'we will get back to you as soon as possible.'
            )
            preventSubmit()
            submitForm.textContent = 'Send'
            submitForm.style.pointerEvents = 'all'
            console.log(`Email has been sent with status: ${response}`)
    
        }).catch(error => {
            throw new Error(error)
        })

    } else {
        // user is offline
        displayModalContent(
            'failure',
            'Oops! 😡',
            'there seems to be a problem with your internet connection, reconnect and try again.'
        )
        allowSubmit()
        submitForm.textContent = 'Send'
        submitForm.style.pointerEvents = 'all'
    }
    return false
})

// display modal with a status
function displayModalContent(status, title, body) {
    let firstName = inputName.value.split(' ')[0]
    modalTitle.textContent = title
    modalBody.textContent = body
    
    if (status === 'success') {
        modalTitle.style.color = softGreen
        modal.style.border = `2px solid ${softGreen}`
        modalHeader.style.borderBottom = `2px solid ${softGreen}`
        modalUser.style.display = 'block'
        modalUser.textContent = `Thanks ${firstName},`
        modalLinks[0].style.display = 'block'

    } else if (status === 'failure') {
        modalTitle.style.color = softRed
        modal.style.border = `2px solid ${softRed}`
        modalHeader.style.borderBottom = `2px solid ${softRed}`
        modalUser.textContent = `Dear ${firstName},`
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
        if (window.navigator.onLine) {
            contactForm.reset()
        }
    })
})

// close modals when clicking on overlay
overlay.addEventListener('click', () => {
    const activeModals = document.querySelectorAll('.modal.active')
    activeModals.forEach(modal => {
        if (modal == null) return
        modal.classList.remove('active')
        overlay.classList.remove('active')
        if (window.navigator.onLine) {
            contactForm.reset()
        }
    })
})

// close modal when pressing esc
body.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { 
        document.querySelector('.modal-close').click()
        if (window.navigator.onLine) {
            contactForm.reset()
        }
    }
})

// add form reset when clicking on modal links
for (let x = 0; x < modalLinks[0].children.length; x++) {
    modalLinks[0].children[x].onclick = () => { 
        if (window.navigator.onLine) {
            contactForm.reset()
        }
    }
}

function createEmailBody() {
    let userName = inputName.value
    let userPhone = inputPhone.value
    let userEmail = inputEmail.value
    let userMessage = inputMessage.value

    return `
            <div>
                <span>( ° ᴗ ° )</span>
                <h4>
                    <span>New submission from</span> 
                    <a href="${prod}" target="_blank" style="text-decoration: none;">
                        <span style="color: ${softBlue};">Makeyev Finance</span>
                    </a>
                </h4>
                <table style="border: 1px solid ${softGrey}; border-collapse: collapse; width: 90%;">
                    <tbody style="font-family: 'Fira Code', sans-serif; font-size: 15px; color: ${softBlack}">
                        <tr style="border: 1px solid ${softBlue}; background: ${softBlue}; color: ${softWhite}; padding: 15px 10px;">
                            <td style="padding: 10px;"><strong>Details</strong></td>
                            <td></td>
                        </tr>
                        <tr style="border: 1px solid ${softGrey};">
                            <td style="border-right: 1px solid ${softGrey}; padding: 10px;">
                                <strong>Name</strong>
                            </td>
                            <td style="padding:10px;">
                                <pre style="margin: 0; white-space: pre-wrap;">${userName}</pre>
                            </td>
                        </tr>

                        <tr style="border: 1px solid ${softGrey};">
                            <td style="border-right: 1px solid ${softGrey}; padding: 10px;">
                                <strong>Phone</strong>
                            </td>
                            <td style="padding: 10px;">
                                <a href="tel:${userPhone}" target="_blank" style="margin: 0; white-space: pre-wrap; text-decoration: none;">${userPhone}</a>
                            </td>
                        </tr>

                        <tr style="border: 1px solid ${softGrey};">
                            <td style="border-right: 1px solid ${softGrey}; padding: 10px;">
                                <strong>Email</strong>
                            </td>
                            <td style="padding: 10px;">
                                <a href="mailto:${userEmail}" target="_blank" style="margin: 0; white-space: pre-wrap; text-decoration: none;">${userEmail}</a>
                            </td>
                        </tr>

                        <tr style="border: 1px solid ${softGrey};">
                            <td style="border-right: 1px solid ${softGrey}; padding: 10px;">
                                <strong>Message</strong>
                            </td>
                            <td style="padding: 10px;">
                                <pre style="margin: 0; white-space: pre-wrap;">${userMessage}</pre>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <h5 style="color: ${softBlack}">Sent on ${currentDate()}</h5>
            </div>
           `
}
