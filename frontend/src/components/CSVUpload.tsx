import React, { useState } from 'react';
import { API_BASE_URL } from '../config';

interface CSVUploadProps {
    onUploadSuccess: () => void;
}

export const CSVUpload: React.FC<CSVUploadProps> = ({ onUploadSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

    const handleUpload = (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setUploading(true);
        setMessage(null);

        const formData = new FormData();
        formData.append('file', file);

        fetch(`${API_BASE_URL}/api/upload-csv`, {
            method: 'POST',
            body: formData,
        })
            .then(async res => {
                const data = await res.json();
                if (res.ok) {
                    setMessage({ text: data.message || "Import completed successfully!", isError: false });
                    setFile(null);
                    const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
                    if (fileInput) fileInput.value = '';
                    onUploadSuccess();
                } else {
                    setMessage({ text: data.detail || "Upload failed.", isError: true });
                }
            })
            .catch(err => {
                console.error("Upload failed", err);
                setMessage({ text: "Network error occurred during upload. Ensure the backend is online.", isError: true });
            })
            .finally(() => {
                setUploading(false);
            });
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
                <h2 className="text-xl font-semibold mb-1 text-gray-900 font-sans">Import Exceptions via CSV</h2>
                <p className="text-xs text-gray-500 mb-4 leading-normal">
                    Ingest bulk waivers. Required headers: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800 text-[10px] font-mono break-all font-bold">exception_id,requester_name,requester_email,department,exception_type,justification,request_date,expiry_date,duration_days,approver_name,status,risk_level,is_renewed</code>
                </p>
                
                <form onSubmit={handleUpload} className="space-y-4">
                    <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <svg className="w-8 h-8 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                                </svg>
                                <p className="mb-2 text-xs text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                <p className="text-[10px] text-gray-400">CSV file format only</p>
                            </div>
                            <input 
                                id="csv-file-input" 
                                type="file" 
                                accept=".csv" 
                                className="hidden" 
                                onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        setFile(e.target.files[0]);
                                    }
                                }}
                            />
                        </label>
                    </div>

                    {file && (
                        <div className="text-xs text-gray-700 bg-gray-100 p-2 rounded flex justify-between items-center">
                            <span>Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)</span>
                            <button 
                                type="button" 
                                onClick={() => setFile(null)} 
                                className="text-red-500 hover:text-red-700 font-bold"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!file || uploading}
                        className={`w-full py-2.5 rounded font-medium text-white shadow-sm transition-all ${
                            !file || uploading
                                ? 'bg-blue-300 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                        }`}
                    >
                        {uploading ? "Importing exceptions..." : "Upload & Parse CSV"}
                    </button>
                </form>

                {message && (
                    <div className={`mt-3 p-3 rounded border text-xs ${
                        message.isError 
                            ? 'bg-red-50 text-red-800 border-red-200' 
                            : 'bg-green-50 text-green-800 border-green-200'
                    }`}>
                        {message.text}
                    </div>
                )}
            </div>
        </div>
    );
};
