
# Proxy와 가상 돔을 사용하여 나만의 프레임워크 만들기

## Javascript Proxy

[Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)는 ES2015에 소개된 기능이다. IE11을 제외하고는 모던 브라우저에서 지원하고 있어서 사용할 수 있다. babel로 트랜스파일하여 지원이 되지 않고 있었지만, 구글에서 [폴리필](https://github.com/GoogleChrome/proxy-polyfill)을 만들어 공개하고 있다.

출처: https://babeljs.io/learn-es2015/
![image](https://user-images.githubusercontent.com/26706716/41218297-96f7b5b0-6d95-11e8-94dd-a6c248c1fc9c.png)

Proxy에 대한 사용사례는 [위클리 픽: ES6 기능 - 프락시 사용 사례 10가지](https://github.com/nhnent/fe.javascript/wiki/March-6---March-10,-2017)을 참조하자.

### Proxy를 사용하여 반응하는 모델 클래스 만들기

handler.set()은 객체에 전달되는 시점을 후킹하여 사전 값 검증이나 필요한 처리를 추가할 수 있다. 에제에서는 모델이 변경됨을 감지하고 등록된 콜백함수를 호출하여 모델이 변경되었음을 알리는데 활용한다. 여기까지만 놓고보면 one-way binding을 구현하기 위해 모델의 변경의 변경을 감지하는 단계와 비슷하다.

```js
export default class Model {
    constructor(callback) {
        const proxy = new Proxy(this, {
            get(target, property) {
                return target[property];
            },
            set(target, property, value) {
                const oldValue = target[property];
                target[property] = value;

                // Notify model changes
                if (callback) {
                    callback(property, oldValue, value);
                }

                // Return true if successful. In strict mode, returning false will throw a TypeError exception.
                return true;
            }
        });

        return proxy;
    }
}
```

코드를 보면 Model 클래스는 프로퍼티도 없는 단순한 클래스이다. Model클래스의 생성자는 자신을 반환하지 않고 생성한 Proxy 인스턴스를 반환하도록 되어 있다. 이렇게 되면 Model 인스턴스의 프로퍼티가 변경될 때마다 등록한 `handler.set()`함수가 호출되고 모델의 변경을 감지할 수가 있게 된다.

Model 클래스를 상속받아 클래스 변수들을 추가하는 형태로 사용할 수 있겠다. 혹은 미리 정의한 프로퍼티 이외의 프로퍼티가 추가 및 변경될 경우를 체크하고 에러를 발생시킨다든지 타입이 맞지 않을 경우 에러를 발생시킬 수도 있다.

```js
const predefinedProps = ['name', 'age'];

const handler = {
    set(target, property, value) {
        if (!predefinedProps.includes(property)) {
            throw new TypeError(`${property} cannot be set`);
        }

        if (property === 'age' && !Number.isInteger(value)) {
            throw new TypeError(`${property} is not an integer`);
        }

        target[property] = value;
        return true;
    }
};
```

## 모델을 렌더링하는 뷰 만들기

모델의 값을 가지고 간단한 시계를 만들어 보자. ES6의 템플릿 리터럴(문자열)을 사용하여도 되고 JSX를 사용해도 되겠다. 여기서는 간단하게 템플릿 문자열을 사용해 본다. 뷰와 모델은 아래와 같이 동작한다.

* 타이머가 호출되면 모델의 값을 바꾼다.
* Proxy의 `handler.set()`에서 값의 변경을 후킹한다.
* 콜백함수를 호출하여 뷰에 알린다.
* 뷰의 `render()`를 호출하여 화면을 업데이트한다.

그러면 이제 뷰를 만들어 보자.

### 모델을 가지는 뷰 만들기

View는 컨테이너를 매개변수로 전달받아서 컨테이너에 HTML을 렌더링하는 역할을 한다. View의 생성자에서는 위에서 만든 반응하는 `Model`을 생성하게 되는데, `Model`의 프로퍼티값 변경을 감지할 수 있도록 콜백함수 `onChanges()`를 같이 등록한다. 타이머를 1초마다 동작시켜서 `onTick()`콜백함수에서 모델의 값을 변경하게 된다. `onChanges()`콜백함수에서는 모델 변경이 일어난 경우 `render()`를 호출하여 화면을 갱신한다.

```js
import Model from './model';

export default class View {
    constructor(container) {
        this.container = container;
        this.model = new Model(this.onChanges.bind(this));

        this.timer = setInterval(this.onTick.bind(this), 1000);
    }

    onChanges(property, oldValue, newValue) {
        this.render();
    }

    render() {
        const { hours, minutes, seconds } = this.model;
        const html = `
        <div id="wrapper">
            <span>${hours}</span>:
            <span>${minutes}</span>:
            <span>${seconds}</span>
        </div>`;

        this.container.innerHTML = html;

        console.log('render()');
    }

    onTick() {
        const now = new Date();

        this.model.hours = now.getHours();
        this.model.minutes = now.getMinutes();
        this.model.seconds = now.getSeconds();
    }
}
```

`onTick()` 함수의 구현부를 보면 단순히 `this.model`의 프로퍼티만 변경하고 있음을 알 수 있다. 그럼 렌더링은 언제 불리는거지? 여기가 바로 Proxy의 마법이 일어나는 순간이다. Proxy 덕분에 모델의 변경 후 일일이 렌더링을 해주지 않아도 렌더링이 자동으로 일어나는 것이다. 이 흐름을 정리해 보자.

* `View.onTick()`에서 모델 값 변경
* `Model` 클래스 내부에서 정의한 Proxy `handler.set()`에서 값의 변경을 후킹
* 변경 이벤트를 등록된 콜백함수를 호출하여 알림
* 콜백함수 `View.onChanges()`에서 `View.render()`를 호출하여 렌더링

브라우저의 콘솔창을 보면 `render()`가 1초마다 세 번씩 호출되는 것을 볼 수가 있다. 모델의 값을 3번 변경하였고 변경할 때마다 렌더링이 잘 이루어지는 것을 알 수가 있다.

### 렌더링 횟수 줄이기

모델에서 프로퍼티가 하나 변경될 때마다 렌더링을 하게 될 경우 브라우저에게 지나치게 레이아웃을 시키게 되기 때문에 좋지 않다. 모델의 변경 사항을 모아 두었다가 한번에 렌더링하도록 코드를 변경하자. 한 프레임에서 일어난 모델 변경은 다음 프레임에서 렌더링할 수 있도록 `requestAnimationFrame`을 사용하는 방법이다.

```js
export default class View {
    constructor(container) {
...

        this.renderFunc = this.render.bind(this);
        this.requestRender = 0;
    }

    onChanges(property, oldValue, newValue) {
        if (this.requestRender) {
            cancelAnimationFrame(this.requestRender);
        }

        this.requestRender = requestAnimationFrame(this.renderFunc);
    }

    render() {
...
        this.requestRender = 0;
    }
```

`requestAnimationFrame()`의 리턴값을 사용하여 `onChanges`가 여러 번 호출되더라도 `cancelAnimationFrame()`을 하기 때문에 모델이 빈번하게 변경되는 중간에는 렌더링이 일어나지 않도록 처리한 것이다. 콘솔창을 확인해 보면 이제 1초에 1번만 `render()`가 호출됨을 알 수 있다.

### 값이 변경된 경우만 렌더링하기

시계 예제에서 모델의 변경은 매초마다 일어나게 되는데, 시간과 분 값은 자주 바뀌지 않는 값이다. 그러나 우리가 작성한 `Model`클래스에서는 모든 변경 사항에 대해서 콜백함수를 호출하도록 되어 있다. 모델의 값이 진짜 바뀐 경우만 콜백함수를 호출하도록 개선해보자.

```js
export default class Model {
    constructor(callback) {
        const proxy = new Proxy(this, {
            set(target, property, value) {
                const oldValue = target[property];
                target[property] = value;

                // Notify model changes if value is changed.
                if (value !== oldValue && callback) {
                    callback(property, oldValue, value);
                }
...
            }
        });
...
    }
}
```

이 예제에서는 간단히 `!==`연산자를 사용하여 원시값 및 레퍼런스가 다른 경우만 비교하였다. 이제는 모델 값이 진짜로 바뀐 경우만 콜백함수가 호출되어 한결 마음이 편해졌다.

## 가상돔을 사용하여 렌더링 개선하기

위에서는 모델 변경에 대해서 렌더링하는 횟수를 개선하는 방법에 대해서 살펴보았다. 렌더링을 할 때 HTML을 만들고 `container.innerHTML`을 사용하기 때문에 컨테이너의 자식 HTML은 렌더링할 때마다 모두 교체된다. 시계 에제에서 보면 `hours`와 `minutes`는 자주 바뀌지 않으며 HTML에도 매번 교체될 필요는 없다. 가상 돔을 사용하여 이 부분을 개선해 보자.

### 가상 돔이란

가상 돔은 React, Vue 등의 프레임워크에서 핵심으로 사용되는 기술이다. 렌더링될 때마다 DOM 전체를 교체하는 것이 아니라 변경된 DOM만 비교하여 교체하는 방식이다. React에서는 Reconciliation이라고 부르는데 자세한 사항은 [Weekly Pick: React 렌더링과 성능 알아보기](https://github.com/nhnent/fe.javascript/wiki/March-20---March-24,-2017-(2)#reconciliation-the-diffing-algorithm)를 참고하면 좋다.

이 예제에서는 가상 돔 라이브러리 중 Vue(fork하여 사용)나 Cycle.js에서 사용하고 있는 `snabbdom`을 사용하여 렌더링을 개선해 본다.

### [snabbdom](https://github.com/snabbdom/snabbdom) 설치

`snabbdom` 깃허브의 예제로 가보면 `h()`함수를 사용하여 DOM 노드를 구성하는 사용방법을 볼 수가 있다. 또한 `patch()` 함수를 통하여 변경된 DOM을 찾아서 바꿀 수가 있게 되어 있다.

```js
var snabbdom = require('snabbdom')
var patch = snabbdom.init([ // Init patch function with chosen modules
  require('snabbdom/modules/class').default, // makes it easy to toggle classes
  require('snabbdom/modules/props').default, // for setting properties on DOM elements
  require('snabbdom/modules/style').default, // handles styling on elements with support for animations
  require('snabbdom/modules/eventlisteners').default, // attaches event listeners
]);
var h = require('snabbdom/h').default; // helper function for creating vnodes
var toVNode = require('snabbdom/tovnode').default;

var newVNode = h('div', {style: {color: '#000'}}, [
  h('h1', 'Headline'),
  h('p', 'A paragraph'),
]);

patch(toVNode(document.querySelector('.container')), newVNode)
```

npm을 통해 설치한다.

```cmd
npm install snabbdom
```

### 렌더링 개선하기

개선하기 전에는 아래 그림에서 보는 것처럼 매초마다 컨테이너의 모든 DOM이 교체되고 있는 것을 볼 수가 있다.

![2018-06-11 15_14_25](https://user-images.githubusercontent.com/26706716/41215217-368dbb8a-6d8a-11e8-81ac-ff6f5f4504d0.gif)

가상 돔을 사용하여 변경된 DOM만 교체되도록 해보자.

#### 패키지 가져오기

`snabbdom`에서 ES6 모듈도 지원하고 있다. 아래와 같이 패키지를 가져오고 patch함수를 초기화한다.

```js
import { h, init } from 'snabbdom';
import toVNode from 'snabbdom/es/tovnode';
import props from 'snabbdom/es/modules/props';

const patch = init([props]);
```

#### render() 함수 바꾸기

`h()`함수를 사용하여 가상 노드를 만들고 `patch()`함수를 사용하여 렌더링을 한다.

```js
render() {
    const { hours, minutes, seconds } = this.model;
    const newVNode = h('div', {props: { id: "wrapper"}}, [
        h('span', {}, hours), ':',
        h('span', {}, minutes), ':',
        h('span', {}, seconds)
    ]);

    patch(this.container, newVNode);

...
}
```

이 예제에서 `patch()` 함수의 첫번째 매개변수로 DOM 자체를 넘겼다. 이미 만들어진 DOM을 변경하거나 Server-Side 렌더링을 할 경우 유용한 방법이다. 이 예제의 경우는 해당되지 않으므로 첫 번째 인자도 가상 노드를 넘겨주자. `toVNode()`함수는 DOM을 가상 노드로 변환하는 함수이다.

```js
constructor(container) {
...
    this.vnode = null;
}

render() {
...
    if (!this.vnode) {
        this.vnode = toVNode(this.container);
    }
    this.vnode = patch(this.vnode, newVNode);
...
}
```

이제 브라우저에서 시계 예제를 돌려보면 아래 그림과 같이 변경되는 DOM부분만 정확하게 교체되고 있는 것을 볼 수가 있다.

![2018-06-11 16_29_04](https://user-images.githubusercontent.com/26706716/41217988-9606a5d6-6d94-11e8-908d-84eacf13ea2e.gif)


### 더 개선 해볼 수 있는 것

`snabbdom`의 `h()` 함수를 사용하여 가상 노드를 만들 수가 있는데, 개인적으로는 좀 불편하고 직관성이 떨어진다고 생각한다. 이 글에서 다루지는 않았지만 JSX를 가상 노드로  변환하여 사용할 수 있는 헬퍼들이 있으니 편리성을 위하여 살펴 보아도 좋겠다.

* [snabbdom-jsx](https://github.com/snabbdom-jsx/snabbdom-jsx)
* [snabbdom-pragma](https://github.com/Swizz/snabbdom-pragma)

## 정리

나는 TOAST UI Calendar의 메인테이너를 담당하고 있다. 캘린더의 뷰와 모델은 자체적으로 구현되어 있으며 렌더링을 위해서 handlebars를 사용하고 있다. 어떤 경우에는 DOM을 직접 조작하여 렌더링을 하기도 한다. 이런 경우 내가 겪었던 불편한 점은 handlebars로 HTML을 생성하고 렌더링을 할 때마다 DOM이 모두 교체된다는 것이다. 몇 가지 불편한 점을 들자면, Vue, Angular, jQuery 등을 사용하는 서비스에서 캘린더 내부의 DOM을 외부로 전달하더라도 DOM이 교체되버리면 곧 쓸모가 없어져 버리게 된는 것이다. 렌더링이 일어나면 스크롤 값도 초기화 되어 버린다. 변경된 부분만 렌더링하고 싶은데 일괄적으로 전체 렌더링을 하게 되므로 렌더링 성능이 떨어져 프레임 누락 현상도 일어날 수도 있게 되는 것이다.

이를 개선하기 위한 방법을 여러모로 고심하다가 생각해낸 방법이 이 글에서 소개한 내용이다. 별다른 프레임워크를 사용하지 않고서도 Proxy를 사용하여 모델 변경에 따른 렌더링 흐름을 제어하고 어느 정도 자동화 할 수 있다. 또한 가상 돔을 사용하여 변경된 부분의 DOM만 교체하여 렌더링 성능 또한 개선할 수가 있을 것이다.

추후에 시간이 허락한다면 TOAST UI Calendar에 소개한 기법을 적용하여 렌더링 성능을 개선해 보고자 한다.

이 글에서 만든 예제는 [깃허브](https://github.com/dongsik-yoo/my-custom-framework.git)에서 확인해볼 수 있다.

**실행 방법**
```cmd
git clone https://github.com/dongsik-yoo/my-custom-framework.git
npm install
npm run serve
```
