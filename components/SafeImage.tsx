import Image, { type ImageProps } from "next/image";
import { type Ref } from "react";

type SafeImageProps = ImageProps & {
  ref?: Ref<HTMLImageElement>;
};

export default function SafeImage(props: SafeImageProps) {
  return (
    <Image
      {...props}
      alt={props.alt}
      unoptimized={props.unoptimized ?? true}
    />
  );
}
