import { Button, HTMLSelect, InputGroup, ProgressBar, Slider } from '@blueprintjs/core';
import type { ComponentProps } from 'react';

type Tone = 'neutral' | 'primary' | 'danger' | 'amber' | 'ghost';

type OperatorButtonProps = ComponentProps<typeof Button> & {
  tone?: Tone;
};

export function OperatorButton({ tone = 'neutral', className = '', small = true, ...props }: OperatorButtonProps) {
  return <Button small={small} {...props} className={`stratosyn-control stratosyn-button stratosyn-button-${tone} ${className}`} />;
}

export function OperatorInput({ className = '', fill = true, ...props }: ComponentProps<typeof InputGroup>) {
  return <InputGroup fill={fill} {...props} className={`stratosyn-control stratosyn-input ${className}`} />;
}

export function OperatorSelect({ className = '', fill = true, ...props }: ComponentProps<typeof HTMLSelect>) {
  return <HTMLSelect fill={fill} {...props} className={`stratosyn-control stratosyn-select ${className}`} />;
}

export function OperatorProgress({ className = '', ...props }: ComponentProps<typeof ProgressBar>) {
  return <ProgressBar {...props} className={`stratosyn-control stratosyn-progress ${className}`} />;
}

export function OperatorSlider({ className = '', labelRenderer = false, ...props }: ComponentProps<typeof Slider>) {
  return <Slider labelRenderer={labelRenderer} {...props} className={`stratosyn-control stratosyn-slider ${className}`} />;
}
