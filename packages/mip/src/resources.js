/**
 * @file Resource Function
 * @author xx
 */

import fn from './util/fn'
import Gesture from './util/gesture/index'
import viewport from './viewport'
import rect from './util/dom/rect'
import prerender from './client-prerender'

// const COMPONENTS_NEED_NOT_DELAY = ['MIP-IMG', 'MIP-CAROUSEL', 'MIP-DATA', 'MIP-VIDEO', 'MIP-LAYOUT']

/**
 * Store the resources.
 * @inner
 * @type {Object}
 */
let resources = {}

/**
 * Resources counter.
 * @inner
 * @type {number}
 */
let counter = 0

/**
 * MIP Elements's controller. It's use to manage all the elements's custom life circle and
 * provide the overall interfaces of the MIP Elements.
 *
 * @class
 */

class Resources {
  constructor () {
    /**
     * Resources id
     * @private
     * @type {number}
     */
    this._rid = counter++

    /**
     * Element id
     * @private
     * @type {number}
     */
    this._eid = 0

    // add to resources
    resources[this._rid] = {}

    /**
     * The method to udpate state.
     * @type {Function}
     */
    this.updateState = this._update.bind(this)

    /**
     * Viewport
     * @private
     * @type {Object}
     */
    this._viewport = viewport

    /** @private @type {number} */
    this._rafId = null

    this._gesture = new Gesture(document, {
      preventX: false
    })
    this._bindEvent()
  }

  /**
   * Bind the events of current object.
   */
  _bindEvent () {
    let timer
    this._viewport.on('changed resize', this.updateState)
    this._gesture.on('swipe', (e, data) => {
      let delay = Math.round(data.velocity * 600)
      delay < 100 && (delay = 100)
      delay > 600 && (delay = 600)
      clearTimeout(timer)
      timer = setTimeout(this.updateState, delay)
    })
  }

  /**
   * Add an element for current object and update all the elements's state.
   *
   * @param {MIPElement} element A mip element
   */
  add (element) {
    element._eid = this._eid++
    resources[this._rid][element._eid] = element

    // let fn = () => {
    prerender.execute(() => {
      element.build()
      this.updateState()
    }, element)
    // }
    // COMPONENTS_NEED_NOT_DELAY.indexOf(element.tagName) === -1 ? setTimeout(fn, 20) : fn()
  }

  /**
   * Remove element from current resources object.
   *
   * @param {MIPElement|string} element Mip element or _eid of element
   * @return {boolean} the removed state of element
   */
  remove (element) {
    let id = element._eid || element
    if (isFinite(+id) && resources[this._rid][id]) {
      element.unlayoutCallback && element.unlayoutCallback()
      delete resources[this._rid][id]
      return true
    }
    return false
  }

  /**
   * Return an object of resources.
   *
   * @return {Array}
   */
  getResources () {
    return resources[this._rid]
  }

  /**
   * Return an array of resources.
   *
   * @return {Array}
   */
  getResourcesList () {
    return fn.values(this.getResources())
  }

  /**
   * Set an element's viewport state to 'true' or 'false'.
   *
   * @param {MIPElement} element element
   * @param {boolean} inViewport inViewport
   */
  setInViewport (element, inViewport) {
    if (element.inViewport() !== inViewport) {
      element.viewportCallback(inViewport)
    }
  }

  /**
   * Deffered update elements's viewport state.
   * @return {Promise<undefined>}
   */
  _update () {
    if (!this._rafId) {
      // 改用 raf 让页面一帧只计算一次 update
      this._rafId = fn.raf(() => this._doRealUpdate())
    }
    return this._rafId
  }

  /**
   * Do real update elements's viewport state with performance
   */
  _doRealUpdate () {
    let resources = this.getResources()
    let viewportRect = this._viewport.getRect()
    let i = 0
    let ele = resources[i]
    // 这里需要把 resources 当成一个队列来遍历，
    // 因为组件可能在生命周期内可能产生新的组件实例
    while (ele) {
      if (ele.isBuilt()) {
        // Compute the viewport state of current element.
        // If current element`s prerenderAllowed returns `true` always set the state to be `true`.
        let elementRect = rect.getElementRect(ele)
        let inViewport = ele.prerenderAllowed(elementRect, viewportRect) ||
          rect.overlapping(elementRect, viewportRect) ||
          // 在 ios 有个设置滚动${@link ./viewer.lockBodyScroll} 会设置 scrollTop=1
          // 如果部分元素在顶部而且没有设置高度，会导致 elementRect 和 viewportRect 不重叠，
          // 进而导致无法执行元素的生命周期，针对这种情况做特殊处理
          (elementRect.bottom === 0 && elementRect.top === 0 && viewportRect.top === 1)
        this.setInViewport(ele, inViewport)
      }
      ele = resources[++i]
    }
    this._rafId = null
  }

  /**
   * Forced set the element's viewport state to 'true'.
   *
   * @param {MIPElement} element element
   */
  prerenderElement (element) {
    if (element.inViewport && !element.inViewport()) {
      element.viewportCallback && element.viewportCallback(true)
    }
  }
}

export default new Resources()
