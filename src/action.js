document.getElementById('action').addEventListener('click', () => {
    modal.classList.add('active')
    overlay.classList.add('active')
})

document.querySelector('.form-control').addEventListener('focus', () => {
    document.querySelector('.form-control').classList.add('focused')
})

document.querySelector('.form-control').addEventListener('blur', () => {
    document.querySelector('.form-control').classList.remove('focused')
})

// $(function() {
//     $(".form-control").on('focus', function(){
//           $(this).parents(".form-group").addClass('focused');
//       });
//       $(".form-control").on('blur', function(){
//         $(this).parents(".form-group").removeClass('focused');
//       });
//   });
