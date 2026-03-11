import React, { useEffect } from 'react';

export const KakaoAdFit: React.FC = () => {
    useEffect(() => {
        // Unmount before re-mounting if React StrictMode runs twice
        const existingScript = document.getElementById('kakao-adfit-script');
        if (!existingScript) {
            const script = document.createElement('script');
            script.id = 'kakao-adfit-script';
            script.src = '//t1.daumcdn.net/kas/static/ba.min.js';
            script.async = true;
            document.body.appendChild(script);
        }
    }, []);

    return (
        <div className="flex justify-center w-full my-8 z-10 relative">
            <ins className="kakao_ad_area"
                 style={{ display: 'none' }}
                 data-ad-unit="DAN-Z709wuZSIe2VIrdS"
                 data-ad-width="300"
                 data-ad-height="250">
            </ins>
        </div>
    );
};
