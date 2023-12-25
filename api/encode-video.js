const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = upload.single('video', async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No video file received.');
        }

        const videoBuffer = req.file.buffer;

        // Use fluent-ffmpeg to encode the video
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(videoBuffer)
                .inputFormat('webm')
                .videoCodec('libx264')
                .audioCodec('aac')
                .toFormat('mp4')
                .on('end', () => {
                    console.log('Video encoding complete.');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Error during video encoding:', err);
                    reject(err);
                })
                .save('encoded-video.mp4');
        });

        res.status(200).send('Video encoding complete.');
    } catch (error) {
        console.error('Error during video encoding:', error);
        res.status(500).send('Video encoding failed.');
    }
});