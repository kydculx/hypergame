import React, { useEffect, useRef } from 'react';

export const KakaoAdFit: React.FC = () => {
    const adRef = useRef<HTMLModElement>(null);

    useEffect(() => {
        // adfit script가 이미 다운로드되어 실행되었을 때, 
        // 다시 마운트되는 경우 광고를 새로 렌더링하도록 유도
        
        let script: HTMLScriptElement | null = null;
        const initAd = () => {
            if (adRef.current && !adRef.current.hasChildNodes()) {
                script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = '//t1.daumcdn.net/kas/static/ba.min.js';
                script.async = true;
                adRef.current.appendChild(script);
            }
        };

        initAd();

        // 컴포넌트가 언마운트 될 때, 기존에 렌더링된 광고 요소나 스크립트를 깔끔히 정리
        return () => {
            if (adRef.current) {
                adRef.current.innerHTML = '';
            }
        };
    }, []);

    return (
        <div className="flex justify-center w-full my-8 z-10 relative pointer-events-auto">
            <ins className="kakao_ad_area"
                 style={{ display: 'none' }}
                 data-ad-unit="DAN-Z709wuZSIe2VIrdS"
                 data-ad-width="300"
                 data-ad-height="250"
                 ref={adRef}>
            </ins>
        </div>
    );
};
