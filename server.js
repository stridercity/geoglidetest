const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/encode-video', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No video file received.');
    }

    const videoBuffer = req.file.buffer;

    // Use fluent-ffmpeg to encode the video
    ffmpeg()
        .input(videoBuffer)
        .inputFormat('webm')
        .videoCodec('libx264')
        .audioCodec('aac')
        .toFormat('mp4')
        .on('end', () => {
            console.log('Video encoding complete.');
            res.status(200).send('Video encoding complete.');
        })
        .on('error', (err) => {
            console.error('Error during video encoding:', err);
            res.status(500).send('Video encoding failed.');
        })
        .save('encoded-video.mp4');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});