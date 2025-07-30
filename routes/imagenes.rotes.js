const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: 'dcozwbcpi',
    api_key: '781511879939941',
    api_secret: 'gC7FYuHR8g19tyqoujIs21RtWIk'
});

cloudinary.api.resources({
    type: 'upload',
    prefix: '',
    max_results: 100
}, (error, result) => {
    console.log(result.resources);
});