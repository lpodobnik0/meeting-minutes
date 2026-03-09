import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { ModelManager } from './WhisperModelManager';
import { ParakeetModelManager } from './ParakeetModelManager';
import { LANGUAGES } from './LanguageSelection';


export interface TranscriptModelProps {
    provider: 'localWhisper' | 'parakeet' | 'deepgram' | 'elevenLabs' | 'groq' | 'openai' | 'remoteEndpoint';
    model: string;
    apiKey?: string | null;
    endpointUrl?: string | null;
    language?: string | null;
}

export interface TranscriptSettingsProps {
    transcriptModelConfig: TranscriptModelProps;
    setTranscriptModelConfig: (config: TranscriptModelProps) => void;
    onModelSelect?: () => void;
}

export function TranscriptSettings({ transcriptModelConfig, setTranscriptModelConfig, onModelSelect }: TranscriptSettingsProps) {
    const [apiKey, setApiKey] = useState<string | null>(transcriptModelConfig.apiKey || null);
    const [showApiKey, setShowApiKey] = useState<boolean>(false);
    const [isApiKeyLocked, setIsApiKeyLocked] = useState<boolean>(true);
    const [isLockButtonVibrating, setIsLockButtonVibrating] = useState<boolean>(false);
    const [uiProvider, setUiProvider] = useState<TranscriptModelProps['provider']>(transcriptModelConfig.provider);
    const [endpointUrl, setEndpointUrl] = useState<string>(transcriptModelConfig.endpointUrl || '');
    const [endpointModel, setEndpointModel] = useState<string>(transcriptModelConfig.model || 'whisper-1');
    const [endpointLanguage, setEndpointLanguage] = useState<string>(transcriptModelConfig.language || 'auto');

    // Sync uiProvider when backend config changes (e.g., after model selection or initial load)
    useEffect(() => {
        setUiProvider(transcriptModelConfig.provider);
    }, [transcriptModelConfig.provider]);

    useEffect(() => {
        if (transcriptModelConfig.provider === 'localWhisper' || transcriptModelConfig.provider === 'parakeet') {
            setApiKey(null);
        }
        if (transcriptModelConfig.provider === 'remoteEndpoint') {
            setEndpointUrl(transcriptModelConfig.endpointUrl || '');
            setEndpointModel(transcriptModelConfig.model || 'whisper-1');
            setEndpointLanguage(transcriptModelConfig.language || 'auto');
        }
    }, [transcriptModelConfig.provider]);

    const fetchApiKey = async (provider: string) => {
        try {

            const data = await invoke('api_get_transcript_api_key', { provider }) as string;

            setApiKey(data || '');
        } catch (err) {
            console.error('Error fetching API key:', err);
            setApiKey(null);
        }
    };
    const modelOptions = {
        localWhisper: [], // Model selection handled by ModelManager component
        parakeet: [], // Model selection handled by ParakeetModelManager component
        deepgram: ['nova-2-phonecall'],
        elevenLabs: ['eleven_multilingual_v2'],
        groq: ['llama-3.3-70b-versatile'],
        openai: ['gpt-4o'],
        remoteEndpoint: [], // Model name entered manually
    };
    const requiresApiKey = transcriptModelConfig.provider === 'deepgram' || transcriptModelConfig.provider === 'elevenLabs' || transcriptModelConfig.provider === 'openai' || transcriptModelConfig.provider === 'groq';
    const isRemoteEndpoint = uiProvider === 'remoteEndpoint';

    const handleSaveRemoteEndpoint = async () => {
        const newConfig = {
            ...transcriptModelConfig,
            provider: 'remoteEndpoint' as const,
            model: endpointModel || 'whisper-1',
            apiKey: apiKey,
            endpointUrl: endpointUrl,
            language: endpointLanguage || 'auto',
        };
        setTranscriptModelConfig(newConfig);
        try {
            await invoke('api_save_transcript_config', {
                provider: newConfig.provider,
                model: newConfig.model,
                apiKey: newConfig.apiKey ?? null,
                endpointUrl: newConfig.endpointUrl ?? null,
                language: newConfig.language ?? null,
            });
            toast.success('Remote endpoint saved');
        } catch (err) {
            console.error('Failed to save remote endpoint config:', err);
            toast.error('Failed to save remote endpoint');
        }
    };

    const handleInputClick = () => {
        if (isApiKeyLocked) {
            setIsLockButtonVibrating(true);
            setTimeout(() => setIsLockButtonVibrating(false), 500);
        }
    };

    const handleWhisperModelSelect = (modelName: string) => {
        // Always update config when model is selected, regardless of current provider
        // This ensures the model is set when user switches back
        setTranscriptModelConfig({
            ...transcriptModelConfig,
            provider: 'localWhisper', // Ensure provider is set correctly
            model: modelName
        });
        // Close modal after selection
        if (onModelSelect) {
            onModelSelect();
        }
    };

    const handleParakeetModelSelect = (modelName: string) => {
        // Always update config when model is selected, regardless of current provider
        // This ensures the model is set when user switches back
        setTranscriptModelConfig({
            ...transcriptModelConfig,
            provider: 'parakeet', // Ensure provider is set correctly
            model: modelName
        });
        // Close modal after selection
        if (onModelSelect) {
            onModelSelect();
        }
    };

    return (
        <div>
            <div>
                {/* <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Transcript Settings</h3>
                </div> */}
                <div className="space-y-4 pb-6">
                    <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-1">
                            Transcript Model
                        </Label>
                        <div className="flex space-x-2 mx-1">
                            <Select
                                value={uiProvider}
                                onValueChange={(value) => {
                                    const provider = value as TranscriptModelProps['provider'];
                                    setUiProvider(provider);
                                    if (provider !== 'localWhisper' && provider !== 'parakeet') {
                                        fetchApiKey(provider);
                                    }
                                }}
                            >
                                <SelectTrigger className='focus:ring-1 focus:ring-blue-500 focus:border-blue-500'>
                                    <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="parakeet">⚡ Parakeet (Recommended - Real-time / Accurate)</SelectItem>
                                    <SelectItem value="localWhisper">🏠 Local Whisper (High Accuracy)</SelectItem>
                                    <SelectItem value="remoteEndpoint">🌐 Remote Endpoint (OpenAI-compatible)</SelectItem>
                                    {/* <SelectItem value="deepgram">☁️ Deepgram (Backup)</SelectItem>
                                    <SelectItem value="elevenLabs">☁️ ElevenLabs</SelectItem>
                                    <SelectItem value="groq">☁️ Groq</SelectItem>
                                    <SelectItem value="openai">☁️ OpenAI</SelectItem> */}
                                </SelectContent>
                            </Select>

                            {uiProvider !== 'localWhisper' && uiProvider !== 'parakeet' && (
                                <Select
                                    value={transcriptModelConfig.model}
                                    onValueChange={(value) => {
                                        const model = value as TranscriptModelProps['model'];
                                        setTranscriptModelConfig({ ...transcriptModelConfig, provider: uiProvider, model });
                                    }}
                                >
                                    <SelectTrigger className='focus:ring-1 focus:ring-blue-500 focus:border-blue-500'>
                                        <SelectValue placeholder="Select model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {modelOptions[uiProvider].map((model) => (
                                            <SelectItem key={model} value={model}>{model}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                        </div>
                    </div>

                    {uiProvider === 'localWhisper' && (
                        <div className="mt-6">
                            <ModelManager
                                selectedModel={transcriptModelConfig.provider === 'localWhisper' ? transcriptModelConfig.model : undefined}
                                onModelSelect={handleWhisperModelSelect}
                                autoSave={true}
                            />
                        </div>
                    )}

                    {uiProvider === 'parakeet' && (
                        <div className="mt-6">
                            <ParakeetModelManager
                                selectedModel={transcriptModelConfig.provider === 'parakeet' ? transcriptModelConfig.model : undefined}
                                onModelSelect={handleParakeetModelSelect}
                                autoSave={true}
                            />
                        </div>
                    )}

                    {isRemoteEndpoint && (
                        <div className="mt-4 space-y-3">
                            <div>
                                <Label className="block text-sm font-medium text-gray-700 mb-1">
                                    Endpoint URL
                                </Label>
                                <Input
                                    type="text"
                                    className="mx-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    value={endpointUrl}
                                    onChange={(e) => setEndpointUrl(e.target.value)}
                                    placeholder="http://localhost:8000"
                                />
                                <p className="text-xs text-gray-500 mx-1 mt-1">
                                    Audio will be sent to <code>{'{url}'}/v1/audio/transcriptions</code>
                                </p>
                            </div>
                            <div>
                                <Label className="block text-sm font-medium text-gray-700 mb-1">
                                    Model name
                                </Label>
                                <Input
                                    type="text"
                                    className="mx-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    value={endpointModel}
                                    onChange={(e) => setEndpointModel(e.target.value)}
                                    placeholder="whisper-1"
                                />
                            </div>
                            <div>
                                <Label className="block text-sm font-medium text-gray-700 mb-1">
                                    Language
                                </Label>
                                <Select value={endpointLanguage} onValueChange={setEndpointLanguage}>
                                    <SelectTrigger className="mx-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                                        <SelectValue placeholder="Select language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LANGUAGES.filter(l => l.code !== 'auto-translate').map((l) => (
                                            <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500 mx-1 mt-1">
                                    Pin the transcription language to avoid switching between chunks.
                                </p>
                            </div>
                            <div>
                                <Label className="block text-sm font-medium text-gray-700 mb-1">
                                    Bearer Token (optional)
                                </Label>
                                <div className="relative mx-1">
                                    <Input
                                        type={showApiKey ? "text" : "password"}
                                        className={`pr-16 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${isApiKeyLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                        value={apiKey || ''}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        disabled={isApiKeyLocked}
                                        onClick={handleInputClick}
                                        placeholder="Leave empty if not required"
                                    />
                                    {isApiKeyLocked && (
                                        <div
                                            onClick={handleInputClick}
                                            className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 rounded-md cursor-not-allowed"
                                        />
                                    )}
                                    <div className="absolute inset-y-0 right-0 pr-1 flex items-center">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setIsApiKeyLocked(!isApiKeyLocked)}
                                            className={`transition-colors duration-200 ${isLockButtonVibrating ? 'animate-vibrate text-red-500' : ''}`}
                                            title={isApiKeyLocked ? "Unlock to edit" : "Lock to prevent editing"}
                                        >
                                            {isApiKeyLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                        >
                                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="mx-1">
                                <Button
                                    type="button"
                                    onClick={handleSaveRemoteEndpoint}
                                    className="w-full"
                                >
                                    Save Remote Endpoint
                                </Button>
                            </div>
                        </div>
                    )}

                    {requiresApiKey && (
                        <div>
                            <Label className="block text-sm font-medium text-gray-700 mb-1">
                                API Key
                            </Label>
                            <div className="relative mx-1">
                                <Input
                                    type={showApiKey ? "text" : "password"}
                                    className={`pr-24 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${isApiKeyLocked ? 'bg-gray-100 cursor-not-allowed' : ''
                                        }`}
                                    value={apiKey || ''}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    disabled={isApiKeyLocked}
                                    onClick={handleInputClick}
                                    placeholder="Enter your API key"
                                />
                                {isApiKeyLocked && (
                                    <div
                                        onClick={handleInputClick}
                                        className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 rounded-md cursor-not-allowed"
                                    />
                                )}
                                <div className="absolute inset-y-0 right-0 pr-1 flex items-center">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsApiKeyLocked(!isApiKeyLocked)}
                                        className={`transition-colors duration-200 ${isLockButtonVibrating ? 'animate-vibrate text-red-500' : ''
                                            }`}
                                        title={isApiKeyLocked ? "Unlock to edit" : "Lock to prevent editing"}
                                    >
                                        {isApiKeyLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                    >
                                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    )
}








