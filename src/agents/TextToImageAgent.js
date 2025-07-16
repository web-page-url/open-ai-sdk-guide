import OpenAI from 'openai';

class TextToImageAgent {
    constructor(apiKey) {
        this.openai = new OpenAI({
            apiKey: apiKey
        });
    }

    async generateImage(prompt, options = {}) {
        try {
            const {
                model = 'dall-e-2', // dall-e-2 is cheaper than dall-e-3
                size = '1024x1024', // 256x256, 512x512, 1024x1024 for DALL-E 2
                quality = 'standard', // standard or hd (DALL-E 3 only)
                style = 'vivid', // vivid or natural (DALL-E 3 only)
                n = 1 // number of images (1-10 for DALL-E 2, only 1 for DALL-E 3)
            } = options;

            // Validate prompt
            const validation = this.validatePrompt(prompt);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            console.log(`🖼️ Generating image with DALL-E: ${model}`);

            let requestParams = {
                model: model,
                prompt: prompt,
                n: n,
                size: size,
                response_format: 'url'
            };

            // Add DALL-E 3 specific parameters
            if (model === 'dall-e-3') {
                requestParams.quality = quality;
                requestParams.style = style;
                requestParams.n = 1; // DALL-E 3 only supports n=1
            }

            const response = await this.openai.images.generate(requestParams);

            return {
                success: true,
                images: response.data.map(image => ({
                    url: image.url,
                    revised_prompt: image.revised_prompt || prompt
                })),
                model: model,
                size: size,
                quality: quality,
                style: style,
                originalPrompt: prompt,
                message: `Successfully generated ${response.data.length} image(s) using ${model}`
            };

        } catch (error) {
            console.error('Text-to-Image Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to generate image',
                details: error.response?.data || error
            };
        }
    }

    async generateVariation(imageUrl, options = {}) {
        try {
            const {
                n = 1,
                size = '1024x1024'
            } = options;

            console.log('🖼️ Generating image variation');

            // Note: This would require downloading the image first
            // For now, we'll return a message about this limitation
            return {
                success: false,
                error: 'Image variations require uploading an image file, which is not implemented in this demo',
                details: 'Use the main image generation instead'
            };

        } catch (error) {
            console.error('Image Variation Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to generate image variation',
                details: error.response?.data || error
            };
        }
    }

    // Get available models
    getAvailableModels() {
        return [
            { 
                value: 'dall-e-2', 
                name: 'DALL-E 2', 
                description: 'Cheaper, faster, multiple images supported',
                pricing: '$0.020 per image (1024×1024)'
            },
            { 
                value: 'dall-e-3', 
                name: 'DALL-E 3', 
                description: 'Higher quality, better prompt following',
                pricing: '$0.040 per image (1024×1024 standard)'
            }
        ];
    }

    // Get available sizes by model
    getAvailableSizes(model = 'dall-e-2') {
        if (model === 'dall-e-3') {
            return [
                { value: '1024x1024', name: '1024×1024 (Square)', pricing: '$0.040 standard / $0.080 HD' },
                { value: '1792x1024', name: '1792×1024 (Landscape)', pricing: '$0.080 standard / $0.120 HD' },
                { value: '1024x1792', name: '1024×1792 (Portrait)', pricing: '$0.080 standard / $0.120 HD' }
            ];
        } else {
            return [
                { value: '256x256', name: '256×256', pricing: '$0.016' },
                { value: '512x512', name: '512×512', pricing: '$0.018' },
                { value: '1024x1024', name: '1024×1024', pricing: '$0.020' }
            ];
        }
    }

    // Get quality options (DALL-E 3 only)
    getQualityOptions() {
        return [
            { value: 'standard', name: 'Standard Quality', description: 'Faster and cheaper' },
            { value: 'hd', name: 'HD Quality', description: 'More detailed, costs 2x more' }
        ];
    }

    // Get style options (DALL-E 3 only)
    getStyleOptions() {
        return [
            { value: 'vivid', name: 'Vivid', description: 'Hyper-real and dramatic' },
            { value: 'natural', name: 'Natural', description: 'More natural, less hyper-real' }
        ];
    }

    // Validate prompt
    validatePrompt(prompt) {
        if (!prompt || typeof prompt !== 'string') {
            return { valid: false, error: 'Prompt is required and must be a string' };
        }

        if (prompt.trim().length === 0) {
            return { valid: false, error: 'Prompt cannot be empty' };
        }

        if (prompt.length > 4000) {
            return { valid: false, error: 'Prompt too long. Maximum length is 4000 characters.' };
        }

        // Check for potentially problematic content
        const prohibitedTerms = ['nsfw', 'nude', 'naked', 'sexual', 'violence', 'blood', 'gore'];
        const lowerPrompt = prompt.toLowerCase();
        
        for (const term of prohibitedTerms) {
            if (lowerPrompt.includes(term)) {
                return { 
                    valid: false, 
                    error: `Prompt contains potentially prohibited content: "${term}". Please use appropriate content.` 
                };
            }
        }

        return { valid: true };
    }

    // Get suggested prompts
    getSuggestedPrompts() {
        return [
            "A serene landscape with mountains and a lake at sunset",
            "A futuristic city with flying cars and neon lights",
            "A cute robot reading a book in a cozy library",
            "A magical forest with glowing mushrooms and fairy lights",
            "A steampunk airship floating above clouds",
            "A minimalist workspace with plants and natural light",
            "A cyberpunk street scene with rain and neon reflections",
            "A vintage bicycle in a field of sunflowers",
            "A space station orbiting a distant planet",
            "A cozy coffee shop on a rainy day"
        ];
    }
}

export default TextToImageAgent; 