<?php

$name = $_POST['name'];
$email = $_POST['email'];
$subject = $_POST['subject'];
$message = $_POST['message'];


$domain = 'makeyev-finance.netlify.app';
$email_subject = 'asd';
$email_body = "Name: $name \n".
              "Email; $email \n".
              "Subject: $subject \n".
              "Message: $message \n";


$to 'anatoly.makeyev@gmail.com';

$headers = "from $email \r\n";
$headers .= "Replay To: $email \r\n";

mail($to, $email_subject, $email_body, $headers);
header("Location: contact.html");


?>