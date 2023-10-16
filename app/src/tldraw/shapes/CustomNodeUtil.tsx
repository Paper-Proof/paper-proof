import { GeoShapeUtil, TLGeoShape } from '@tldraw/tldraw';
import React from 'react';

// @ts-ignore
export default class CustomNodeUtil extends GeoShapeUtil {
  static override type = 'customNode' as const

  override component(shape: TLGeoShape) {
    // Important to store it here and not later
    const superRender = super.component(shape);

    const className = `
      ${shape.meta.type}
      ${shape.meta.isFocused ? '-focused' : '-not-focused'}
      ${shape.props.text.includes("🎉") ? '-successful-tactic' : ''}
    `

    return <div className={className}>
      {superRender}
    </div>
  }

  override indicator(shape: TLGeoShape) {
    // Can't return null here because of GeoShapeUtil's typings
    return <div/>
  }
}