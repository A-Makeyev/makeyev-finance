// find element by xpath
function getXPath(path) {
    return document.evaluate(
        path, document, null,
        XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue
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
    let validName = /^[a-zA-Z\u0590-\u05FF ,.'-]+$/i.test(inputName.value)

    if (validPhone && validName) {
        submitForm.disabled = false
        submitForm.style.cursor = 'pointer'
        submitForm.classList.remove('btn-black')
        submitForm.classList.add('btn-blue')
    } else {
        submitForm.disabled = true
        submitForm.style.cursor = 'not-allowed'
        submitForm.classList.remove('btn-blue')
        submitForm.classList.add('btn-black')
    }
}

form.addEventListener('submit', (event) => {
    event.preventDefault()

    setTimeout(() => { submitForm.click() }, 500)

    let data = new FormData(event.target)
    fetch(event.target.action, {
        method: form.method,
        body: data,
        headers: {
            'Accept': 'application/json'
        }

    }).then(response => {
        displayModal(
            'success',
            'message sent! 🤑',
            'we will get back to you as soon as possible.'
        )

        console.log(response)
        form.reset()
        
    }).catch(error => {
        displayModal(
            'failure',
            'Oops! ⚠️',
            'There seems to be a problem with your internet connection, reconnect and try again.'
        )

        let savedName = inputName.value ? inputName.value : ''
        let savedPhone = inputPhone.value ? inputPhone.value : ''
        let savedEmail = inputEmail.value ? inputEmail.value : ''
        let savedMessage = inputMessage.value ? inputMessage.value : ''

        form.reset()

        setTimeout(() => {
            inputName.value = savedName
            inputPhone.value = savedPhone
            inputEmail.value = savedEmail
            inputMessage.value = savedMessage
        }, 500)

        throw new Error(error)
    })
})

// display modal with a status
function displayModal(status, title, body) {
    openModal.forEach(button => {
        button.addEventListener('click', () => {
            let modal = document.querySelector(button.dataset.modalTarget)
            if (modal == null) return

            modal.classList.add('active')
            overlay.classList.add('active')

            modalTitle.innerText = title
            modalBody.innerText = body

            if (status === 'success') {
                modalTitle.style.color = softGreen
                modal.style.border = `2px solid ${softGreen}`
                modalHeader.style.borderBottom = `2px solid ${softGreen}`
                modalUser.innerText = `Thanks ${inputName.value},`

            } else if (status === 'failure') {
                modalTitle.style.color = softRed
                modal.style.border = `2px solid ${softRed}`
                modalHeader.style.borderBottom = `2px solid ${softRed}`
                modalLinks[0].style.display = 'none'
            }
        })
    })
    
    closeModal.forEach(button => {
        button.addEventListener('click', () => {
            let modal = button.closest('.modal')
            if (modal == null) return
            modal.classList.remove('active')
            overlay.classList.remove('active')
            form.reset()
        })
    })
    
    overlay.addEventListener('click', () => {
        const activeModals = document.querySelectorAll('.modal.active')
        activeModals.forEach(modal => {
            if (modal == null) return
            modal.classList.remove('active')
            overlay.classList.remove('active')
            form.reset()
        })
    })

    // add form reset when clicking on modal links
    for (let x = 0; x < modalLinks[0].children.length; x++) {
        modalLinks[0].children[x].setAttribute('onclick', () => { form.reset() })
    }
}

// close modal when pressing esc
body.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { 
        document.querySelector('.modal-close').click()
        form.reset()
    }
})
