import OpenAI from 'openai';

class TextToSpeechAgent {
    constructor(apiKey) {
        this.openai = new OpenAI({
            apiKey: apiKey
        });
    }

    async convertTextToSpeech(text, options = {}) {
        try {
            const {
                voice = 'alloy', // alloy, echo, fable, onyx, nova, shimmer
                model = 'tts-1', // tts-1 is cheaper than tts-1-hd
                format = 'mp3', // mp3, opus, aac, flac
                speed = 1.0 // 0.25 to 4.0
            } = options;

            // Validate text length (max 4096 characters for TTS)
            if (text.length > 4096) {
                throw new Error('Text too long. Maximum length is 4096 characters.');
            }

            console.log(`🗣️ Converting text to speech with voice: ${voice}`);

            const response = await this.openai.audio.speech.create({
                model: model,
                voice: voice,
                input: text,
                response_format: format,
                speed: speed
            });

            // Return the audio buffer
            const buffer = Buffer.from(await response.arrayBuffer());
            
            return {
                success: true,
                audioBuffer: buffer,
                format: format,
                voice: voice,
                textLength: text.length,
                message: `Successfully converted ${text.length} characters to speech using ${voice} voice`
            };

        } catch (error) {
            console.error('Text-to-Speech Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to convert text to speech',
                details: error.response?.data || error
            };
        }
    }

    // Get available voices
    getAvailableVoices() {
        return [
            { value: 'alloy', name: 'Alloy (Neutral)' },
            { value: 'echo', name: 'Echo (Male)' },
            { value: 'fable', name: 'Fable (British Male)' },
            { value: 'onyx', name: 'Onyx (Deep Male)' },
            { value: 'nova', name: 'Nova (Female)' },
            { value: 'shimmer', name: 'Shimmer (Soft Female)' }
        ];
    }

    // Get available models
    getAvailableModels() {
        return [
            { value: 'tts-1', name: 'TTS-1 (Standard Quality)', description: 'Faster and cheaper' },
            { value: 'tts-1-hd', name: 'TTS-1-HD (High Quality)', description: 'Higher quality but more expensive' }
        ];
    }

    // Validate text for TTS
    validateText(text) {
        if (!text || typeof text !== 'string') {
            return { valid: false, error: 'Text is required and must be a string' };
        }

        if (text.trim().length === 0) {
            return { valid: false, error: 'Text cannot be empty' };
        }

        if (text.length > 4096) {
            return { valid: false, error: 'Text too long. Maximum length is 4096 characters.' };
        }

        return { valid: true };
    }
}

export default TextToSpeechAgent; 