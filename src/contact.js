// prevent modal animation on page load
if (messageModal) messageModal.style.display = 'none'
if (actionFormModal) actionFormModal.style.display = 'none'

setTimeout(() => {
    if (messageModal) messageModal.style.display = 'block'
    if (actionFormModal) actionFormModal.style.display = 'block'
}, 2500)

// add a button to fill form on dev environment
function fillForm() {
    if (window.location.href.includes(dev)) {
        let button = document.createElement('button')
        button.className = 'hero-btn btn-orange'
        button.setAttribute('id', 'dev-btn')
        button.textContent = 'add details'
        button.style.marginTop = '10px'
        button.style.width = '110%'

        contactForm.appendChild(button)

        function alignButton() {
            if (window.matchMedia('(max-width: 1600px)').matches) {
                button.style.display = 'none'
            } else {
                button.style.display = 'inline-block'
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
}
fillForm()

// reset labels after submit
function resetLabels() {
    for (let x = 1; x <= formInputs.length; x++) {
        getXPath(`(${inputXPath})[${x}]`).style.boxShadow = `0 4px 2px -2px ${softBlack}`
        getXPath(`(${inputXPath})[${x}]`).style.border = `1px solid ${softBlack}`
        getXPath(`(${labelXPath})[${x}]`).style.color = softGrey
        getXPath(`(${labelXPath})[${x}]`).style.cursor = 'text'
        getXPath(`(${labelXPath})[${x}]`).style.left = '20px'
        getXPath(`(${labelXPath})[${x}]`).style.top = '35px'
    }
}
 
for (let x = 1; x <= formInputs.length; x++) {
    // input labels go up on focus 
    getXPath(`(${inputXPath})[${x}]`).addEventListener('focus', () => {
        getXPath(`(${inputXPath})[${x}]`).style.boxShadow = `0 4px 2px -2px ${softBlue}`
        getXPath(`(${inputXPath})[${x}]`).style.border = `2px solid ${softBlue}`
        getXPath(`(${labelXPath})[${x}]`).style.color = softBlue
        getXPath(`(${labelXPath})[${x}]`).style.cursor = 'default'
        getXPath(`(${labelXPath})[${x}]`).style.top = '0'

        if (language == 'english') {
            getXPath(`(${labelXPath})[${x}]`).style.left = '0'
        } 

        // setTimeout(() => { 
        //     if (getXPath(`(${labelXPath})[${x}]`).textContent.slice(-1) !== ':') {
        //         getXPath(`(${labelXPath})[${x}]`).textContent += ':'
        //     }
        // }, 250)
    })

    // input labels go down on blur 
    getXPath(`(${inputXPath})[${x}]`).addEventListener('blur', () => {
        let value = getXPath(`(${inputXPath})[${x}]`).value
        if (value.length < 1 && value === '') {
            getXPath(`(${inputXPath})[${x}]`).style.boxShadow = `0 4px 2px -2px ${softBlack}`
            getXPath(`(${inputXPath})[${x}]`).style.border = `1px solid ${softBlack}`
            getXPath(`(${labelXPath})[${x}]`).style.color = softGrey
            getXPath(`(${labelXPath})[${x}]`).style.cursor = 'text'
            getXPath(`(${labelXPath})[${x}]`).style.top = '35px'

            if (language == 'hebrew') {
                getXPath(`(${labelXPath})[${x}]`).style.left = '40px'
            } else if (language == 'english') {
                getXPath(`(${labelXPath})[${x}]`).style.left = '20px'
            }

            // setTimeout(() => { 
            //     let text = getXPath(`(${labelXPath})[${x}]`).textContent.slice(0, -1)
            //     getXPath(`(${labelXPath})[${x}]`).textContent = text
            // }, 250)
        }
    })

    getXPath(`(${inputXPath})[${x}]`).addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            submitForm.click()
        }
    })
}

function validateForm() {
    let validName = nameRegex.test(inputName.value) 
    let validPhone = phoneRegex.test(inputPhone.value)
    let validEmail // action form doesn't include email

    inputName.onchange = () => {
        if (!validName) {
            inputName.style.borderColor = softRed
            inputName.previousElementSibling.style.color = softRed
            inputName.style.boxShadow = `0 4px 2px -2px ${softRed}`
        }
    }

    inputPhone.onchange = () => {
        if (!validPhone) {
            inputPhone.style.borderColor = softRed
            inputPhone.previousElementSibling.style.color = softRed
            inputPhone.style.boxShadow = `0 4px 2px -2px ${softRed}`
        }
    }

    if (inputEmail !== null) {
        validEmail = emailRegex.test(inputEmail.value) 
        inputEmail.onchange = () => {
            if (!validEmail) {
                inputEmail.style.borderColor = softRed
                inputEmail.previousElementSibling.style.color = softRed
                inputEmail.style.boxShadow = `0 4px 2px -2px ${softRed}`
            }
        }
    }

    if (inputEmail !== null) {
        validName && validPhone && validEmail ? allowSubmit() : preventSubmit()
    } else {
        validName && validPhone ? allowSubmit() : preventSubmit()
    }
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

        if (language == 'hebrew') {
            submitForm.textContent = 'שולח'
        } else if (language == 'english') {
            submitForm.textContent = 'Sending'
        }
 
        if (language == 'hebrew') {
            submitForm.innerHTML = '<i class="fas fa-paper-plane spin"></i>'
        } else if (language == 'english') {
            for (let x = 0; x < 3; x++) {
                setTimeout(() => {
                    submitForm.textContent += '.'
                    if (x === 2) submitForm.innerHTML += '<i class="fas fa-paper-plane"></i>'
                }, (x * 250))
            }
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
            if (action !== null) 
                actionFormModal.classList.remove('active')

            resetLabels()
            displayModalContent('success')
            
            preventSubmit()
            contactForm.reset()
            
            if (language == 'hebrew') {
                submitForm.textContent = 'שלחו'
            } else if (language == 'english') {
                submitForm.textContent = 'Send'
            }

            submitForm.style.pointerEvents = 'all'
            console.log(`Email has been sent with status: ${response}`)

        }).catch(error => {
            throw new Error(error)
        })
        
    // user is offline
    } else { 
        if (action !== null) 
            actionFormModal.classList.remove('active')

        displayModalContent('failure')
        allowSubmit()
        
        if (language == 'hebrew') {
            submitForm.textContent = 'שלחו'
        } else if (language == 'english') {
            submitForm.textContent = 'Send'
        }

        submitForm.style.pointerEvents = 'all'
    }
    return false
})

// display modal with a status
function displayModalContent(status) {
    let firstName = inputName.value.split(' ')[0]

    if (status === 'success') {
        modalTitle.style.color = softGreen
        modal.style.border = `2px solid ${softGreen}`
        modalHeader.style.borderBottom = `2px solid ${softGreen}`
        modalUser.style.display = 'block'
        modalLinks[0].style.display = 'block'
        
        if (language == 'hebrew') {
            modalTitle.textContent = '🙂 ההודעה נשלחה'
            modalBody.textContent = 'נחזור אליכם בהקדם האפשרי'
            modalUser.textContent = `תודה ${firstName}`
        } else if (language == 'english') {
            modalTitle.textContent = 'message sent! 🙂'
            modalBody.textContent = 'we will get back to you as soon as possible.'
            modalUser.textContent = `Thanks ${firstName},`
        }

    } else if (status === 'failure') {
        modalTitle.style.color = softRed
        modal.style.border = `2px solid ${softRed}`
        modalHeader.style.borderBottom = `2px solid ${softRed}`
        modalLinks[0].style.display = 'none'

        if (language == 'hebrew') {
            modalTitle.textContent = '🙁 אופס'
            modalBody.textContent = 'נראה שיש לכם בעיה באינטרנט, תתחברו מחדש ותנסו שוב'
        } else if (language == 'english') {
            modalTitle.textContent = 'Oops! 🙁'
            modalBody.textContent = 'there seems to be a problem with your internet connection, reconnect and try again.'
        }
    }

    setTimeout(() => {
        modal.classList.add('active')
        overlay.classList.add('active')
    }, 150)
}

// close modals when clicking on close modal button
closeModal.forEach(button => {
    button.addEventListener('click', () => {
        let modal = button.closest('.modal')
        if (modal !== null) modal.classList.remove('active')
        if (actionFormModal !== null) actionFormModal.classList.remove('active')
        
        overlay.classList.remove('active')
        if (window.navigator.onLine) {
            contactForm.reset()
            preventSubmit()
            resetLabels()
        }
    })
})

// close modals when clicking on overlay
overlay.addEventListener('click', () => {
    const activeModals = document.querySelectorAll('.active')
    activeModals.forEach(modal => {
        if (modal == null) return
        modal.classList.remove('active')
        overlay.classList.remove('active')
        if (window.navigator.onLine) {
            contactForm.reset()
            preventSubmit()
            resetLabels()
        }
    })
})

// close modal when pressing esc
body.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { 
        document.querySelector('.modal-close').click()
        if (window.navigator.onLine) {
            contactForm.reset()
            preventSubmit()
            resetLabels()
        }
    }
})

// add form reset when clicking on modal links
if (typeof modalLinks[0] !== 'undefined') {
    for (let x = 0; x < modalLinks[0].children.length; x++) {
        modalLinks[0].children[x].onclick = () => { 
            if (window.navigator.onLine) {
                contactForm.reset()
            }
        }
    }
}

// action form modal
if (action !== null) {
    action.addEventListener('click', () => {
        actionFormModal.classList.add('active')
        overlay.classList.add('active')
    })
}

function createEmailBody() {
    let userName = inputName.value
    let userPhone = inputPhone.value
    let userMessage = inputMessage.value
    let userEmail

    if (inputEmail !== null) 
        userEmail = inputEmail.value

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

                        ${inputEmail !== null ?
                        ` 
                            <tr style="border: 1px solid ${softGrey};">
                                <td style="width: 20%; border-right: 1px solid ${softGrey}; padding: 10px;">
                                    <strong>Email</strong>
                                </td>
                                <td style="padding: 10px;">
                                    <a href="mailto:${userEmail}" target="_blank" style="margin: 0; white-space: pre-wrap; text-decoration: none;">${userEmail}</a>
                                </td>
                            </tr>
                        `   
                        : ``}

                        ${userMessage.trim() !== '' ? 
                        `
                            <tr style="border: 1px solid ${softGrey};">
                                <td style="width: 20%; border-right: 1px solid ${softGrey}; padding: 10px;">
                                    <strong>Message</strong>
                                </td>
                                <td style="padding: 10px;">
                                    <pre style="margin: 0; white-space: pre-wrap;">${userMessage}</pre>
                                </td>
                            </tr>
                        `
                        : ``}

                    </tbody>
                </table>
                <p style="color: ${softBlack}; font-weight: 600;">Sent on ${currentDateTime()}</p>
                <span>( ° ᴗ ° )</span>
            </div>
           `
}
