const fs = require('fs');
const path = require('path');
const axios = require('axios');
const googleTTS = require('google-tts-api');
const player = require('play-sound')((opts = {}));
const AudioRecorder = require('node-audiorecorder');

require('dotenv').config();
const apiKey = process.env.OPENAI_API_KEY;

// Groq API and OpenAI API keys
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const AUDIO_FILENAME = process.env.AUDIO_FILENAME;
const GROQ_ASR_MODEL = process.env.GROQ_ASR_MODEL;
const GROQ_MODEL = process.env.GROQ_MODEL;

// Function to record audio using node-audiorecorder
function recordAudio(filename, duration = 5) {
  return new Promise((resolve, reject) => {
    const options = {
      program: 'sox', // Can be 'rec', 'arecord', or 'sox'
      device: null,   // Use default device
      bits: 16,       // 16-bit sample size
      channels: 1,    // Mono channel
      encoding: 'signed-integer',
      format: 'S16_LE',
      rate: 16000,    // 16kHz sample rate
      type: 'wav',    // Output file type
      silence: 2,     // Stop after 2 seconds of silence
      thresholdStart: 0.5,  // Silence threshold to start recording
      thresholdStop: 0.5,   // Silence threshold to stop recording
      keepSilence: true  // Keep silence in the recording
    };

    const audioRecorder = new AudioRecorder(options, console);

    // Start recording
    console.log('Recording started...');
    audioRecorder.start();

    // Handle stream and write to file
    const fileStream = fs.createWriteStream(filename);
    audioRecorder.stream().pipe(fileStream);

    audioRecorder.on('start', function () {
      console.log('Audio recording started.');
    });

    // Make sure to resolve Promise once the recording is done
    audioRecorder.on('end', function () {
      console.log('Audio recording finished.');
      resolve(filename);  // Resolves the Promise when recording ends
    });

    audioRecorder.on('error', function (err) {
      console.error('Error occurred during recording:', err);
      reject(err);  // Reject if an error occurs during recording
    });

    audioRecorder.on('close', function () {
      console.log('Recording closed.');
    });

    // Stop recording after specified duration
    setTimeout(() => {
      console.log(`Stopping the recording after ${duration} seconds...`);
      audioRecorder.stop();  // This should trigger the 'end' event
    }, duration * 1000);

    // Add a fallback mechanism to detect if the 'end' event is never called
    setTimeout(() => {
      console.log('Warning: Recording timeout reached (this should never happen).');
      reject(new Error('Recording timed out without finishing.'));
    }, (duration + 2) * 1000);  // Give extra time for event resolution

    console.log("=============resume process");
    process.stdin.resume();  // Keep process alive during recording
  });
}

// Function to transcribe audio (simulated with a mock function)
async function transcribeAudio(filename) {
  const fileBuffer = fs.readFileSync(filename);
  // Simulate transcription (in real use, you'd call the transcription API)
  return "Hello, I need assistance with my account.";
}

// Function to generate response from LLM (Groq)
async function generateResponse(prompt) {
  try {
    const response = await axios.post(
      'https://api.groq.com/v1/chat/completions',
      {
        model: GROQ_MODEL,
        messages: [
          {
            role: 'user',
            content: `You are Kurapal, an AI assistant for Kuraway, a global B2B marketplace connecting African merchants with buyers worldwide. You would need to engage in discussions with our customers.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 1,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: true,
        stop: null,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].delta.content;
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error('Response generation failed');
  }
}

// Function to convert text to speech using Google TTS
function textToSpeech(text, outputFile = 'output.mp3') {
  const url = googleTTS.getAudioUrl(text, {
    lang: 'en',
    slow: false,
    host: 'https://translate.google.com',
  });

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputFile);
    file.on('finish', () => resolve(outputFile));

    axios({ url, responseType: 'stream' })
      .then((response) => {
        response.data.pipe(file);
      })
      .catch((error) => {
        console.error('Error generating speech:', error);
        reject(error);
      });
  });
}

// Function to play audio
function playAudio(filePath) {
  player.play(filePath, (err) => {
    if (err) console.error('Error playing audio:', err);
  });
}

// Main function to orchestrate the entire process
async function main() {
  try {
    console.log("Starting the main process...");
    // Step 1: Record audio
    const audioFile = AUDIO_FILENAME;
    await recordAudio(audioFile, 5); // Wait for the recording to finish
    console.log("Recording complete...");

    // Step 2: Transcribe audio to text
    console.log('Transcribing audio...');
    const userInput = await transcribeAudio(audioFile);
    console.log(`User input: ${userInput}`);

    // Step 3: Generate response using Groq's LLM
    console.log('Generating response...');
    const response = await generateResponse(userInput);
    console.log(`AI response: ${response}`);

    // Step 4: Convert response to speech
    const ttsFile = 'output.mp3';
    await textToSpeech(response, ttsFile);
    console.log(`Text-to-speech conversion complete. Saved as ${ttsFile}`);

    // Step 5: Play the response
    console.log('Playing the generated response...');
    playAudio(ttsFile);
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Start the process
main();
