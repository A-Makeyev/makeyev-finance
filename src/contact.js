// add a button to fill form on dev environment
(function fillForm() {
    if (window.location.href.includes(dev)) {
        let button = document.createElement('button')
        button.setAttribute('id', 'dev-btn')
        button.textContent = 'add test details'
        button.className = 'hero-btn btn-orange'
        contactForm.appendChild(button)

        function alignButton() {
            if (window.matchMedia('(max-width: 1300px)').matches) {
                button.style.display = 'block'
                button.style.margin = '20px 0'
            } else {
                button.style.display = 'inline-block'
                button.style.margin = '0 10px 0'
            }
        }

        window.addEventListener('DOMContentLoaded', alignButton)
        window.addEventListener('resize', alignButton)

        button.addEventListener('click', () => {
            let details = [
                'Estebon Villalon',
                '+972-52-696-9696',
                'villabon@este.lon',
                'Baguette Du Fromage '
            ]

            for (let x = 0; x < formLabels.length; x++) {
                setTimeout(() => {
                    if (x == 3) details[x] = details[x].repeat(9)
                    formInputs[x].focus()
                    formInputs[x].value = details[x]
                }, (x * 500))
            }
            allowSubmit()
        })
    }
})()

// reset labels after submit
function resetLabels() {
    for (let x = 1; x <= formInputs.length; x++) {
        getXPath(`(${inputXPath})[${x}]`).style.border = `1px solid ${softBlack}`
        getXPath(`(${labelXPath})[${x}]`).style.color = softGrey
        getXPath(`(${labelXPath})[${x}]`).style.left = '20px'
        getXPath(`(${labelXPath})[${x}]`).style.top = '35px'
    }
}

// initialize input fields 
for (let x = 1; x <= formInputs.length; x++) {
    getXPath(`(${inputXPath})[${x}]`).addEventListener('focus', () => {
        getXPath(`(${inputXPath})[${x}]`).style.boxShadow = `0 4px 2px -2px ${softBlue}`
        getXPath(`(${inputXPath})[${x}]`).style.border = `2px solid ${softBlue}`
        getXPath(`(${labelXPath})[${x}]`).style.color = softBlue
        getXPath(`(${labelXPath})[${x}]`).style.left = '0'
        getXPath(`(${labelXPath})[${x}]`).style.top = '0'
        setTimeout(() => { 
            if (getXPath(`(${labelXPath})[${x}]`).textContent.slice(-1) !== ':') {
                getXPath(`(${labelXPath})[${x}]`).textContent += ':'
            }
        }, 250)
    })

    getXPath(`(${inputXPath})[${x}]`).addEventListener('blur', () => {
        let value = getXPath(`(${inputXPath})[${x}]`).value
        if (value.length < 1 && value === '') {
            getXPath(`(${inputXPath})[${x}]`).style.boxShadow = `0 4px 2px -2px ${softBlack}`
            getXPath(`(${inputXPath})[${x}]`).style.border = `1px solid ${softBlack}`
            getXPath(`(${labelXPath})[${x}]`).style.color = softGrey
            getXPath(`(${labelXPath})[${x}]`).style.left = '20px'
            getXPath(`(${labelXPath})[${x}]`).style.top = '35px'
            setTimeout(() => { 
                let text = getXPath(`(${labelXPath})[${x}]`).textContent.slice(0, -1)
                getXPath(`(${labelXPath})[${x}]`).textContent = text
            }, 250)
        }
    })

    getXPath(`(${inputXPath})[${x}]`).addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            submitForm.click()
        }
    })
}

function validateForm() {
    let validName = /^[^0-9.,_!¡?÷?¿/\\+=@#$%ˆ&*(){}|~<>;:[\]]{2,}$/.test(inputName.value) 
    let validPhone = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/.test(inputPhone.value) 
    let validEmail = /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(inputEmail.value) 
 
    inputName.onchange = () => {
        if (!validName) {
            inputName.style.borderColor = softRed
            inputName.previousElementSibling.style.color = softRed
        }
    }

    inputPhone.onchange = () => {
        if (!validPhone) {
            inputPhone.style.borderColor = softRed
            inputPhone.previousElementSibling.style.color = softRed
        }
    }

    inputEmail.onchange = () => {
        if (!validEmail) {
            inputEmail.style.borderColor = softRed
            inputEmail.previousElementSibling.style.color = softRed
        }
    }

    validPhone && validEmail && validName ? allowSubmit() : preventSubmit()
}

function allowSubmit() {
    submitForm.disabled = false
    submitForm.style.cursor = 'pointer'
    submitForm.classList.remove('btn-black')
    submitForm.classList.add('btn-blue')
}

function preventSubmit() {
    submitForm.disabled = true
    submitForm.style.cursor = 'not-allowed'
    submitForm.classList.remove('btn-blue')
    submitForm.classList.add('btn-black')
}

// submit form & send email only if user is online
contactForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    if (window.navigator.onLine) {
        preventSubmit()
        submitForm.style.pointerEvents = 'none'
        submitForm.classList.remove('btn-black')
        submitForm.classList.add('btn-blue')
    
        for (let x = 0; x < 3; x++) {
            setTimeout(() => {
                submitForm.textContent += '.'
                if (x === 2) submitForm.innerHTML += '<i class="fas fa-paper-plane"></i>'
            }, (x * 250))
        }
        
        Email.send({
            // enable less secure apps
            // https://myaccount.google.com/lesssecureapps
            SecureToken: smtpToken,
            To: mainMail,
            From: companyMail,
            Subject: 'New Customer 🤩',
            Body: createEmailBody()

        }).then(response => {
            resetLabels()
            displayModalContent(
                'success',
                'message sent! 🙂',
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
            'Oops! 🙁',
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
                <h4>
                    <span>New submission from</span> 
                    <a href="${prod}" target="_blank" style="text-decoration: none;">
                        <span style="color: ${softBlue};">Makeyev Finance</span>
                    </a>
                </h4>
                <table style="border: 1px solid ${softGrey}; border-collapse: collapse; width: 100%;">
                    <tbody style="font-family: 'Fira Code', sans-serif; font-size: 15px; color: ${softBlack}">
                        <tr style="border: 1px solid ${softBlue}; background: ${softBlue}; color: ${softWhite}; padding: 15px 10px;">
                            <td style="padding: 10px;"><strong>Details</strong></td>
                            <td></td>
                        </tr>
                        <tr style="border: 1px solid ${softGrey};">
                            <td style="width: 20%; border-right: 1px solid ${softGrey}; padding: 10px;">
                                <strong>Name</strong>
                            </td>
                            <td style="padding:10px;">
                                <pre style="margin: 0; white-space: pre-wrap;">${userName}</pre>
                            </td>
                        </tr>

                        <tr style="border: 1px solid ${softGrey};">
                            <td style="width: 20%; border-right: 1px solid ${softGrey}; padding: 10px;">
                                <strong>Phone</strong>
                            </td>
                            <td style="padding: 10px;">
                                <a href="tel:${userPhone}" target="_blank" style="margin: 0; white-space: pre-wrap; text-decoration: none;">${userPhone}</a>
                            </td>
                        </tr>

                        <tr style="border: 1px solid ${softGrey};">
                            <td style="width: 20%; border-right: 1px solid ${softGrey}; padding: 10px;">
                                <strong>Email</strong>
                            </td>
                            <td style="padding: 10px;">
                                <a href="mailto:${userEmail}" target="_blank" style="margin: 0; white-space: pre-wrap; text-decoration: none;">${userEmail}</a>
                            </td>
                        </tr>

                        <tr style="border: 1px solid ${softGrey};">
                            <td style="width: 20%; border-right: 1px solid ${softGrey}; padding: 10px;">
                                <strong>Message</strong>
                            </td>
                            <td style="padding: 10px;">
                                <pre style="margin: 0; white-space: pre-wrap;">${userMessage}</pre>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <p style="color: ${softBlack}; font-weight: 600;">Sent on ${currentDateTime()}</p>
                <span>( ° ᴗ ° )</span>
            </div>
           `
}
