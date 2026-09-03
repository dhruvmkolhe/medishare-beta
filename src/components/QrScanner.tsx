import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useTranslation } from 'react-i18next';
import { Camera, X, Upload, AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  onScan: (credentialId: string) => void;
}

export default function QrScanner({ onScan }: Props) {
  const { t } = useTranslation();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractCredentialId = (decodedText: string): string | null => {
    const match = decodedText.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
    return match ? match[0] : null;
  };

  const handleScanSuccess = (decodedText: string) => {
    const id = extractCredentialId(decodedText);
    if (id) {
      stopScanning();
      onScan(id);
    } else {
      setError(`QR Code detected, but no valid credential UUID found: "${decodedText}"`);
    }
  };

  const startScanning = async () => {
    setError(null);
    setScanning(true);
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    if (!scanning) return;

    let isMounted = true;
    const scannerId = 'qr-scanner-container';

    const initScanner = async () => {
      try {
        // 1. Explicitly prompt the browser's native camera permission dialog
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            stream.getTracks().forEach(track => track.stop());
          } catch (permErr: any) {
            if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
              throw new Error('Camera permission was blocked. Please tap the lock/site settings icon in your browser address bar and enable Camera access.');
            } else if (permErr.name === 'NotFoundError' || permErr.name === 'DevicesNotFoundError') {
              throw new Error('No camera found on this device. You can upload a QR image or enter the Credential ID below.');
            }
          }
        }

        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        let cameraConfig: any = { facingMode: 'environment' };
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
            if (selectedCamera) {
              cameraConfig = { deviceId: { exact: selectedCamera } };
            } else {
              const backCam = devices.find(d => 
                d.label.toLowerCase().includes('back') || 
                d.label.toLowerCase().includes('rear') || 
                d.label.toLowerCase().includes('environment')
              );
              cameraConfig = backCam ? { deviceId: { exact: backCam.id } } : { deviceId: { exact: devices[0].id } };
            }
          }
        } catch {
          cameraConfig = { facingMode: 'environment' };
        }

        if (!isMounted) return;

        await scanner.start(
          cameraConfig,
          {
            fps: 15,
            qrbox: undefined,
          },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {}
        );
      } catch (err: any) {
        console.error('Scanner init error:', err);
        if (isMounted) {
          setError(err?.message || 'Unable to access camera. Please allow camera permissions in your browser or upload a QR image below.');
          setScanning(false);
        }
      }
    };

    initScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
          scannerRef.current.clear();
        } catch {}
        scannerRef.current = null;
      }
    };
  }, [scanning, selectedCamera]);

  const scanImageFileWithFallbacks = async (file: File): Promise<string> => {
    const tempScanner = new Html5Qrcode('qr-file-dummy-container');
    
    // Attempt 1: Direct scan
    try {
      const text = await tempScanner.scanFile(file, false);
      tempScanner.clear();
      return text;
    } catch {
      try { tempScanner.clear(); } catch {}
    }

    // Attempt 2: Canvas normalization with white quiet-zone padding & scaling
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 800;
            let w = img.naturalWidth || img.width;
            let h = img.naturalHeight || img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }

            const padding = 40;
            canvas.width = w + padding * 2;
            canvas.height = h + padding * 2;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas context unavailable'));
              return;
            }

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, padding, padding, w, h);

            canvas.toBlob(async (blob) => {
              if (!blob) {
                reject(new Error('Canvas conversion failed'));
                return;
              }
              const processedFile = new File([blob], 'processed_qr.png', { type: 'image/png' });
              const retryScanner = new Html5Qrcode('qr-file-dummy-container');
              try {
                const text = await retryScanner.scanFile(processedFile, false);
                retryScanner.clear();
                resolve(text);
              } catch (err2) {
                try { retryScanner.clear(); } catch {}
                reject(err2);
              }
            }, 'image/png');
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      const decodedText = await scanImageFileWithFallbacks(file);
      const id = extractCredentialId(decodedText);
      if (id) {
        onScan(id);
      } else {
        setError(`No valid credential UUID found in uploaded image: "${decodedText}"`);
      }
    } catch (err: any) {
      console.error('File scan error:', err);
      setError('Could not detect a QR code in the uploaded image. Make sure the QR code is clearly visible.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="w-full space-y-4">
      <div id="qr-file-dummy-container" className="hidden" />

      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Camera / Scan Notice</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {!scanning ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={startScanning}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 px-4 rounded-lg hover:bg-slate-800 transition-colors font-medium text-sm"
          >
            <Camera className="h-4 w-4 text-green-400" />
            {t('verify.startScan')}
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-xs text-slate-400 font-medium">OR</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-2.5 px-4 rounded-lg hover:bg-slate-200 border border-slate-200 transition-colors font-medium text-sm"
          >
            <Upload className="h-4 w-4 text-slate-500" />
            Scan / Upload QR Photo
          </button>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shadow-inner">
          <div id="qr-scanner-container" className="w-full aspect-square max-h-[360px] overflow-hidden" />
          
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const currentIndex = cameras.findIndex(c => c.id === selectedCamera);
                  const nextCamera = cameras[(currentIndex + 1) % cameras.length];
                  setSelectedCamera(nextCamera.id);
                }}
                className="p-2 bg-slate-900/80 text-white backdrop-blur rounded-full hover:bg-slate-800 transition-colors"
                title="Switch Camera"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={stopScanning}
              className="p-2 bg-slate-900/80 text-white backdrop-blur rounded-full hover:bg-slate-800 transition-colors"
              title="Close Scanner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3 bg-slate-900 text-center text-xs text-slate-400 border-t border-slate-800">
            Position QR code within the viewfinder frame
          </div>
        </div>
      )}
    </div>
  );
}
