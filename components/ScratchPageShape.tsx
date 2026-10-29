import { HTMLContainer, Rectangle2d, ShapeUtil, T, TLBaseShape } from "tldraw";

export const SCRATCH_PAGE_TYPE = "scratch-page";

export type ScratchSide = "left" | "right";

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [SCRATCH_PAGE_TYPE]: {
      w: number;
      h: number;
      pageIndex: number;
      side: ScratchSide;
    };
  }
}

export type ScratchPageShape = TLBaseShape<
  typeof SCRATCH_PAGE_TYPE,
  { w: number; h: number; pageIndex: number; side: ScratchSide }
>;

export class ScratchPageShapeUtil extends ShapeUtil<ScratchPageShape> {
  static override type = SCRATCH_PAGE_TYPE;
  static override props = {
    w: T.number,
    h: T.number,
    pageIndex: T.number,
    side: T.literalEnum("left", "right"),
  };

  override canResize() {
    return false;
  }
  override canEdit() {
    return false;
  }
  override hideRotateHandle() {
    return true;
  }

  getDefaultProps(): ScratchPageShape["props"] {
    return { w: 0, h: 0, pageIndex: 0, side: "right" };
  }

  getGeometry(shape: ScratchPageShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: ScratchPageShape) {
    return (
      <HTMLContainer style={{ width: shape.props.w, height: shape.props.h }} />
    );
  }

  indicator(shape: ScratchPageShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
