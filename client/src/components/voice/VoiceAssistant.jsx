import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Mic, Square, Volume2, X } from 'lucide-react'
import { api } from '../../services/api'

const quickQueries = [
  { text: 'Slots available?', lang: 'en' },
  { text: 'कितने स्लॉट खाली हैं?', lang: 'hi' },
  { text: 'Zone A status?', lang: 'en' },
  { text: 'Parking full hai?', lang: 'hi' }
]

function chooseVoice(voices, lang) {
  const languageTag = lang === 'hi' ? 'hi-IN' : 'en-US'
  return voices.find((voice) => voice.lang === languageTag) || voices.find((voice) => voice.lang.startsWith(lang === 'hi' ? 'hi' : 'en')) || null
}

export default function VoiceAssistant() {
  const [open, setOpen] = useState(false)
  const [language, setLanguage] = useState('en')
  const [phase, setPhase] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [responseText, setResponseText] = useState('')
  const [errorText, setErrorText] = useState('')
  const [supported, setSupported] = useState(true)
  const [voices, setVoices] = useState([])
  const recognitionRef = useRef(null)
  const phaseRef = useRef('idle')

  const bars = useMemo(() => Array.from({ length: 18 }, (_, index) => index), [])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      return undefined
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US'

    recognition.onstart = () => {
      setErrorText('')
      setTranscript('')
      setResponseText('')
      setPhase('listening')
    }

    recognition.onresult = async (event) => {
      let finalText = ''
      let interimText = ''

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result[0]?.transcript || ''
        if (result.isFinal) {
          finalText += `${text} `
        } else {
          interimText += `${text} `
        }
      }

      const liveText = (finalText || interimText).trim()
      setTranscript(liveText)

      if (finalText.trim()) {
        setPhase('processing')
        try {
          const response = await api.post('/voice/query', {
            text: finalText.trim(),
            language
          })

          const reply = response.data?.data?.response || 'No response available.'
          setResponseText(reply)
          setPhase('speaking')

          if (window.speechSynthesis) {
            window.speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance(reply)
            utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US'
            utterance.rate = 0.9
            utterance.pitch = 1
            utterance.voice = chooseVoice(voices, language)
            utterance.onend = () => setPhase('idle')
            utterance.onerror = () => setPhase('idle')
            window.speechSynthesis.speak(utterance)
          } else {
            setPhase('idle')
          }
        } catch (error) {
          setErrorText(error?.response?.data?.error || 'Voice request failed.')
          setPhase('idle')
        }
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted' && phaseRef.current === 'idle') {
        return
      }

      if (event.error === 'not-allowed') {
        setErrorText(language === 'hi' ? 'माइक्रोफोन की अनुमति नहीं मिली।' : 'Microphone permission denied.')
      } else if (event.error === 'no-speech') {
        setErrorText(language === 'hi' ? 'कोई आवाज़ नहीं मिली।' : 'No speech detected.')
      } else {
        setErrorText(language === 'hi' ? 'वॉइस इनपुट में समस्या आई।' : 'Voice input failed.')
      }
      setPhase('idle')
    }

    recognition.onend = () => {
      if (phaseRef.current === 'listening') {
        setPhase('idle')
      }
    }

    recognitionRef.current = recognition

    if (window.speechSynthesis) {
      const syncVoices = () => {
        setVoices(window.speechSynthesis.getVoices())
      }
      syncVoices()
      window.speechSynthesis.onvoiceschanged = syncVoices
    }

    return () => {
      recognition.stop()
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [language, voices.length])

  function speak(text, lang) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-US'
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.voice = chooseVoice(voices, lang)
    utterance.onend = () => setPhase('idle')
    utterance.onerror = () => setPhase('idle')
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  async function runQuery(text, lang) {
    setLanguage(lang)
    setTranscript(text)
    setResponseText('')
    setErrorText('')
    setPhase('processing')

    try {
      const response = await api.post('/voice/query', { text, language: lang })
      const reply = response.data?.data?.response || 'No response available.'
      setResponseText(reply)
      setPhase('speaking')
      speak(reply, lang)
    } catch (error) {
      setErrorText(error?.response?.data?.error || 'Voice request failed.')
      setPhase('idle')
    }
  }

  function toggleMic() {
    if (!supported) {
      setErrorText('Use Chrome browser for voice.')
      return
    }

    if (!recognitionRef.current) {
      setErrorText('Voice input is not ready yet.')
      return
    }

    if (phase === 'listening') {
      recognitionRef.current.stop()
      setPhase('idle')
      return
    }

    try {
      recognitionRef.current.lang = language === 'hi' ? 'hi-IN' : 'en-US'
      recognitionRef.current.start()
    } catch {
      setErrorText('Unable to start microphone.')
      setPhase('idle')
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="glass-card mb-4 w-[min(24rem,calc(100vw-2rem))] border border-brand-cyan/30 p-4 shadow-2xl shadow-brand-cyan/15">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-orbitron text-sm text-brand-cyan">SmartPark Voice AI</h3>
              <p className="text-[11px] text-slate-400">Tap mic to ask about parking</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`rounded-lg px-2 py-1 text-xs ${language === 'en' ? 'bg-brand-cyan text-dark-base' : 'bg-dark-surface text-slate-300'}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`rounded-lg px-2 py-1 text-xs ${language === 'hi' ? 'bg-brand-cyan text-dark-base' : 'bg-dark-surface text-slate-300'}`}
              >
                हिं
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-300 hover:bg-white/10">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-brand-cyan/20 bg-dark-surface/80 p-4">
            {!supported ? <div className="mb-3 rounded-xl border border-brand-amber/40 bg-brand-amber/10 px-3 py-2 text-xs text-brand-amber">Use Chrome browser for voice.</div> : null}
            {errorText ? <div className="mb-3 rounded-xl border border-brand-red/40 bg-brand-red/10 px-3 py-2 text-xs text-brand-red">{errorText}</div> : null}

            <div className="mb-4 flex flex-col items-center text-center">
              <button
                type="button"
                onClick={toggleMic}
                className={`relative flex h-24 w-24 items-center justify-center rounded-full border text-white transition ${
                  phase === 'listening'
                    ? 'border-brand-green bg-brand-green/20 shadow-[0_0_30px_rgba(0,255,136,0.25)]'
                    : phase === 'speaking'
                      ? 'border-brand-cyan bg-brand-cyan/20 shadow-[0_0_30px_rgba(0,229,255,0.25)]'
                      : 'border-brand-cyan/40 bg-gradient-to-br from-brand-cyan to-brand-violet shadow-[0_0_30px_rgba(0,229,255,0.18)]'
                }`}
              >
                {phase === 'processing' ? <Loader2 className="animate-spin" size={30} /> : phase === 'listening' ? <Square size={28} /> : <Mic size={30} />}
                {phase === 'listening' ? <span className="absolute inset-0 animate-ping rounded-full border border-brand-green/60" /> : null}
              </button>

              <p className="mt-4 text-sm font-medium text-white">
                {phase === 'idle' && 'Tap mic to ask about parking'}
                {phase === 'listening' && 'Listening'}
                {phase === 'processing' && 'Processing your query'}
                {phase === 'speaking' && 'Speaking response'}
              </p>
            </div>

            <div className="mb-4 min-h-[90px] rounded-2xl border border-brand-cyan/15 bg-dark-base/70 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-brand-cyan">
                {phase === 'speaking' ? <Volume2 size={12} /> : <Mic size={12} />}
                {phase === 'speaking' ? 'Response' : 'Live Transcript'}
              </div>
              <p className="text-sm text-slate-100">
                {phase === 'speaking' ? responseText || 'Response will appear here.' : transcript || 'Your words will appear here while listening.'}
              </p>
            </div>

            <div className="mb-4 h-16 rounded-2xl border border-brand-cyan/15 bg-dark-base/70 px-3 py-2">
              <div className="flex h-full items-end justify-between gap-1">
                {bars.map((bar) => (
                  <span
                    key={bar}
                    className={`w-1 rounded-full transition-all duration-300 ${
                      phase === 'speaking' ? 'bg-brand-cyan' : phase === 'listening' ? 'bg-brand-green' : 'bg-brand-cyan/30'
                    }`}
                    style={{
                      height: phase === 'idle' ? '8px' : `${14 + ((bar * 9) % 28)}px`
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {quickQueries.map((query) => (
                <button
                  key={`${query.lang}-${query.text}`}
                  type="button"
                  onClick={() => runQuery(query.text, query.lang)}
                  className="rounded-xl border border-brand-cyan/20 bg-dark-base/70 px-3 py-2 text-left text-xs text-slate-200 transition hover:border-brand-cyan/50 hover:bg-brand-cyan/10"
                >
                  {query.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-cyan to-brand-violet text-white shadow-[0_0_30px_rgba(0,229,255,0.35)]"
        aria-label="Open SmartPark Voice AI"
      >
        <Mic size={26} />
        <span className="absolute -right-1 -top-1 rounded-full bg-brand-cyan px-1.5 py-0.5 text-[10px] font-semibold text-dark-base">AI</span>
      </button>
    </div>
  )
}
