import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, RotateCcw, CheckCircle } from 'lucide-react';

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (signatureData: string) => void;
    monthName: string;
}

const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onSave, monthName }) => {
    const sigCanvas = useRef<SignatureCanvas>(null);

    if (!isOpen) return null;

    const clear = () => {
        sigCanvas.current?.clear();
    };

    const save = () => {
        console.log('SignatureModal: Save button clicked');
        // Simple alert to verify the function is even called
        // alert('Botón pulsado, iniciando proceso...'); 

        if (!sigCanvas.current) {
            console.error('SignatureModal: sigCanvas.current is null!');
            alert('Error interno: El panel de firma no está listo.');
            return;
        }

        if (sigCanvas.current.isEmpty()) {
            console.log('SignatureModal: Canvas is empty');
            alert('Por favor, firma antes de guardar.');
            return;
        }

        try {
            console.log('SignatureModal: Getting canvas data...');
            // Standard toDataURL on the canvas element directly
            const canvas = sigCanvas.current.getCanvas();
            const data = canvas.toDataURL('image/png');
            console.log('SignatureModal: Data captured, calling onSave...');
            onSave(data);
        } catch (err) {
            console.error('SignatureModal: Fatal error in save():', err);
            alert('Error al procesar la firma: ' + err);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-indigo-950 p-6 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold">Firma Mensual</h3>
                        <p className="text-indigo-200 text-sm">Validación de jornada: {monthName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 overflow-hidden mb-4">
                        <SignatureCanvas
                            ref={sigCanvas}
                            penColor="#1e1b4b"
                            canvasProps={{
                                className: 'w-full h-64 cursor-crosshair'
                            }}
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        <p className="text-xs text-gray-500 italic">
                            Al firmar, confirmo que los registros diarios de jornada de este mes son veraces y correctos según lo registrado en el sistema.
                        </p>

                        <div className="flex gap-4">
                            <button
                                onClick={clear}
                                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                            >
                                <RotateCcw size={18} />
                                Limpiar
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    console.log('Button: onClick triggered');
                                    save();
                                }}
                                className="flex-[2] flex items-center justify-center gap-2 py-3 px-8 bg-indigo-600 rounded-xl text-white font-bold hover:bg-indigo-700 shadow-md active:bg-indigo-800"
                            >
                                <CheckCircle size={18} />
                                Guardar y Firmar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignatureModal;
