import { useEffect, useState } from 'react';
import './Toggle.scss';

interface IToggle {
    className?: string,
    defaultChecked: boolean,
    onChange: (enabled: boolean) => void;
}

export function Toggle({ defaultChecked, onChange, className }: IToggle) {
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        setChecked(defaultChecked);
    }, [defaultChecked]);

    const onValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setChecked(!checked);
        onChange(e.target.checked);
    }

    return (
        <label className={`toggle ${className}`}>
            <input type="checkbox" checked={checked} onChange={onValueChange}/>
            <span className="slider round"></span>
        </label>
    );
}
