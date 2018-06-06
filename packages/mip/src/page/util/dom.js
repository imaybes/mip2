/**
 * @file define dom functions
 * @author wangyisheng@baidu.com (wangyisheng)
 */

import css from '../../util/dom/css'
import sandbox from '../../sandbox'

import {MIP_IFRAME_CONTAINER, XIONGZHANG_MORE_BUTTON_GROUP} from '../const'

let {window: sandWin, document: sandDoc} = sandbox
let activeZIndex = 10000

export function createIFrame (fullpath, pageId, {onLoad, onError} = {}) {
  let container = document.querySelector(`.${MIP_IFRAME_CONTAINER}[data-page-id="${pageId}"]`)

  // if exists, delete it first
  if (container) {
    container.parentNode.removeChild(container)
  }

  container = document.createElement('iframe')
  container.onload = () => {
    typeof onLoad === 'function' && onLoad()
  }
  container.onerror = () => {
    typeof onError === 'function' && onError()
  }
  // TODO: use XHR to load iframe so that we can get httpRequest.status 404
  container.setAttribute('name', pageId)
  container.setAttribute('src', fullpath)
  container.setAttribute('class', MIP_IFRAME_CONTAINER)

  /**
   * Fix an iOS iframe width bug, see examples/mip1/test.html
   * https://stackoverflow.com/questions/23083462/how-to-get-an-iframe-to-be-responsive-in-ios-safari
   */
  container.setAttribute('width', '100%')
  container.setAttribute('scrolling', 'no')

  container.setAttribute('data-page-id', pageId)
  container.setAttribute('sandbox', 'allow-top-navigation allow-popups allow-scripts allow-forms allow-pointer-lock allow-popups-to-escape-sandbox allow-same-origin allow-modals')
  document.body.appendChild(container)

  return container
}

export function removeIFrame (pageId) {
  let container = document.querySelector(`.${MIP_IFRAME_CONTAINER}[data-page-id="${pageId}"]`)
  if (container) {
    container.parentNode.removeChild(container)
  }
}

export function getIFrame (iframe) {
  if (typeof iframe === 'string') {
    return document.querySelector(`.${MIP_IFRAME_CONTAINER}[data-page-id="${iframe}"]`)
  }

  return iframe
}

function hideAllIFrames () {
  document.querySelectorAll(`.${MIP_IFRAME_CONTAINER}`).forEach(iframe => css(iframe, 'display', 'none'))
}

export function createLoading (pageMeta) {
  let loading = document.createElement('div')
  loading.id = 'mip-page-loading'
  loading.setAttribute('class', 'mip-page-loading')
  loading.innerHTML = `
    <div class="mip-page-loading-header">
      <span class="back-button">
        <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><style/></defs><path d="M769.405 977.483a68.544 68.544 0 0 1-98.121 0L254.693 553.679c-27.173-27.568-27.173-72.231 0-99.899L671.185 29.976c13.537-13.734 31.324-20.652 49.109-20.652s35.572 6.917 49.109 20.652c27.173 27.568 27.173 72.331 0 99.899L401.921 503.681l367.482 373.904c27.074 27.568 27.074 72.231 0 99.899z"/></svg>
      </span>
      <div class="mip-appshell-header-logo-title">
        <img class="mip-appshell-header-logo" src="${pageMeta.header.logo}">
        <span class="mip-appshell-header-title"></span>
      </div>
    </div>
  `
  document.body.appendChild(loading)
}

export function getLoading (targetMeta, onlyHeader) {
  let loading = document.querySelector('#mip-page-loading')
  if (!targetMeta) {
    return loading
  }

  if (onlyHeader) {
    loading.classList.add('only-header')
  } else {
    loading.classList.remove('only-header')
  }

  if (!targetMeta.header.show) {
    css(loading.querySelector('.mip-page-loading-header'), 'display', 'none')
  } else {
    css(loading.querySelector('.mip-page-loading-header'), 'display', 'flex')
  }

  let $logo = loading.querySelector('.mip-appshell-header-logo')
  if (targetMeta.header.logo) {
    $logo.setAttribute('src', targetMeta.header.logo)
    css($logo, 'display', 'block')
  } else {
    css($logo, 'display', 'none')
  }

  if (targetMeta.header.title) {
    loading.querySelector('.mip-appshell-header-title')
      .innerHTML = targetMeta.header.title
  }

  if (targetMeta.view.isIndex) {
    css(loading.querySelector('.back-button'), 'display', 'none')
  } else {
    css(loading.querySelector('.back-button'), 'display', 'flex')
  }

  return loading
}

export function getMIPShellConfig () {
  let rawJSON
  let $shell = document.body.querySelector('mip-shell')
  if ($shell) {
    rawJSON = $shell.children[0].innerHTML
  }
  try {
    return JSON.parse(rawJSON)
  } catch (e) {}

  return {}
}

export function addMIPCustomScript (win = window) {
  let doc = win.document
  let script = doc.querySelector('script[type="application/mip-script"]')
  if (!script) {
    return
  }

  let customFunction = getSandboxFunction(script.innerHTML)
  script.remove()

  win.addEventListener('ready-to-watch', () => customFunction(sandWin, sandDoc))
}

function getSandboxFunction (script) {
  /* eslint-disable no-new-func */
  return new Function('window', 'document', `
        let {alert, close, confirm, prompt, setTimeout, setInterval, self, top} = window

        ${script}
    `)
  /* eslint-enable no-new-func */
}

export const inBrowser = typeof window !== 'undefined'

let transitionEndEvent = 'transitionend'
let animationEndEvent = 'animationend'

if (window.ontransitionend === undefined &&
    window.onwebkittransitionend !== undefined) {
  transitionEndEvent = 'webkitTransitionEnd'
}

if (window.onanimationend === undefined &&
    window.onwebkitanimationend !== undefined) {
  animationEndEvent = 'webkitAnimationEnd'
}

export const raf = inBrowser
  ? window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : setTimeout
  : fn => fn()

export function nextFrame (fn) {
  raf(() => {
    raf(fn)
  })
}

export function whenTransitionEnds (el, type, cb) {
  if (!type) {
    return cb()
  }

  const event = type === 'transition' ? transitionEndEvent : animationEndEvent
  const onEnd = e => {
    if (e.target === el) {
      end()
    }
  }
  const end = () => {
    el.removeEventListener(event, onEnd)
    cb()
  }
  el.addEventListener(event, onEnd)
}

/**
 * Forward iframe animation
 *
 * @param {string} pageId targetPageId
 * @param {Object} options
 * @param {boolean} options.transition allowTransition
 * @param {Object} options.targetMeta pageMeta of target page
 * @param {string} options.newPage whether iframe is just created
 * @param {Function} options.onComplete callback on complete
 */
export function frameMoveIn (pageId, {transition, targetMeta, newPage, onComplete} = {}) {
  let iframe = getIFrame(pageId)

  if (!iframe) {
    return
  }

  if (transition) {
    let loading = getLoading(targetMeta)
    css(loading, 'display', 'block')

    loading.classList.add('slide-enter', 'slide-enter-active')

    // trigger layout
    /* eslint-disable no-unused-expressions */
    loading.offsetWidth
    /* eslint-enable no-unused-expressions */

    let done = () => {
      hideAllIFrames()
      css(loading, 'display', 'none')
      css(iframe, {
        'z-index': activeZIndex++,
        display: 'block'
      })

      onComplete && onComplete()
    }
    whenTransitionEnds(loading, 'transition', () => {
      loading.classList.remove('slide-enter-to', 'slide-enter-active')

      if (newPage) {
        setTimeout(done, 100)
      } else {
        done()
      }
    })

    nextFrame(() => {
      loading.classList.add('slide-enter-to')
      loading.classList.remove('slide-enter')
    })
  } else {
    hideAllIFrames()
    css(iframe, {
      'z-index': activeZIndex++,
      display: 'block'
    })
    onComplete && onComplete()
  }
}

/**
 * Backward iframe animation
 *
 * @param {string} pageId currentPageId
 * @param {Object} options
 * @param {boolean} options.transition allowTransition
 * @param {Object} options.sourceMeta pageMeta of current page
 * @param {string} options.targetPageId indicating target iframe id when switching between iframes. undefined when switching to init page.
 * @param {Function} options.onComplete callback on complete
 */
export function frameMoveOut (pageId, {transition, sourceMeta, targetPageId, onComplete} = {}) {
  let iframe = getIFrame(pageId)

  if (!iframe) {
    return
  }

  if (targetPageId) {
    let targetIFrame = getIFrame(targetPageId)
    activeZIndex -= 2
    css(targetIFrame, {
      display: 'block',
      'z-index': activeZIndex++
    })
  }

  if (transition) {
    let loading = getLoading(sourceMeta, true)
    css(loading, 'display', 'block')

    iframe.classList.add('slide-leave', 'slide-leave-active')
    loading.classList.add('slide-leave', 'slide-leave-active')

    // trigger layout
    /* eslint-disable no-unused-expressions */
    iframe.offsetWidth
    /* eslint-enable no-unused-expressions */

    whenTransitionEnds(iframe, 'transition', () => {
      css(iframe, {
        display: 'none',
        'z-index': 10000
      })
      css(loading, 'display', 'none')
      iframe.classList.remove('slide-leave-to', 'slide-leave-active')
      loading.classList.remove('slide-leave-to', 'slide-leave-active')
      onComplete && onComplete()
    })

    nextFrame(() => {
      iframe.classList.add('slide-leave-to')
      iframe.classList.remove('slide-leave')
      loading.classList.add('slide-leave-to')
      loading.classList.remove('slide-leave')
    })
  } else {
    css(iframe, {
      display: 'none',
      'z-index': 10000
    })
    onComplete && onComplete()
  }
}

function renderMoreButton ({name, text, link} = {}) {
  if (!name || !text) {
    return
  }

  return `
    <div class="mip-shell-button" mip-header-btn data-button-name="${name}">
      ${link ? `<a mip-link href="${link}">${text}</a>` : text}
    </div>
  `
}

/**
 * Create wrapper for more button in header
 *
 * @param {Object} options
 * @param {Array<Object>} options.buttonGroup configures for buttonGroup. This will be ignored when xiongzhang = true
 * @param {boolean} options.xiongzhang enables xiongzhanghao or not
 */
export function createMoreButtonWrapper ({buttonGroup, xiongzhang} = {}) {
  if (xiongzhang) {
    buttonGroup = XIONGZHANG_MORE_BUTTON_GROUP
  }

  if (!Array.isArray(buttonGroup)) {
    return
  }

  let mask = document.createElement('div')
  mask.classList.add('mip-shell-more-button-mask')
  document.body.appendChild(mask)

  let buttonWrapper = document.createElement('div')
  buttonWrapper.classList.add('mip-shell-more-button-wrapper')

  let buttonGroupHTMLArray = []
  buttonGroup.forEach(button => {
    let tmp = renderMoreButton(button)
    tmp && buttonGroupHTMLArray.push(tmp)
  })

  css(buttonWrapper, 'height', 48 * buttonGroupHTMLArray.length)
  buttonWrapper.innerHTML = buttonGroupHTMLArray.join('')
  document.body.appendChild(buttonWrapper)

  return {mask, buttonWrapper}
}

/**
 * Create page mask to cover header
 * Mainly used in dialog within iframes
 */
export function createPageMask () {
  let mask = document.createElement('div')
  mask.classList.add('mip-shell-header-mask')
  document.body.appendChild(mask)

  return mask
}
