let x: number = 3;
let xx: undefined | string
const y = "str"
var z : number | String;
;
;

function a() {
    ;return 5;
}


function b(arg: any, x: number | something): number {
    return 5;
}

if (x == 3) {
    x = 4;
}
if (x>3) x++;
let data = [] as any;

let x2 = {3: 4} as any;
const sta = {a: 1, b: 2, c: {d: 3, [x2]: {f: 4}}};

type x = {z: number, x:(number,test:string) => number | string, g:(number|string), a:(x)=>number, b:(x:number)=>void|string, c: ()=>void}

(data[3]?.test as any)!.a++ + (4 as number);

const str : string = "test";

let arr: number[] | undefined;
let sa : [number, string] = [3, "test"];

arr?.[1] as number & {test: number};
arr![1];

function lala<T>(): T {
    return {} as T;
}

function sdf(t: '3' | {x: y}) {}
sdf({y:3})

function select(t: 'a' | 'b' | 3) {}
select(3);

const lala2 = <T extends Record<string, number>>(x: T): T => {
    return {} as T;
}

function rest(...args: number[]): number {
    return args.reduce((a, b) => a + b);
}
let i: any = 3;
i = i=3, i==4;

for(i=0,x=0; i < 10 as boolean; i++) {  }
for(;;) { break }

for(let abc: string;;) { break }
for(var abc:number|string=0;;) { break }

abstract class X<T extends Record<number,any>> extends Array<T> {
    arg: number;
    constructor(...args: T[]) {
        super(...args);
    }
    method(): void {}
    abstract abstractMethod(): void;
    get length(): number {
        return super.length;
    }
}

interface Something extends X<Record<number, string>> {
    a: number;
    b: string;
    c: () => void;
}

let XXXX = class name<S, T> {
    constructor() {}
};

new XXXX<number,string>();

let text = `This ${2 + (3 as number)} ${`works`}`;

enum E2 {
    A,
    B = 42,
    C
}
  
const enum Direction {
    Up,
    Down,
    Left,
    Right,
};

switch (day) {
    case 0+a() as any:
        console.log("It is a Sunday.");
        break;
    case 1:
        console.log("It is a Monday.");
        // Fall through
    default:
        console.log("It's a day")
    case 2:
        console.log("It is a Tuesday.");
        break;
}

// templated args:
templatedFunc<X|Y>;
templatedFunc<X|Y>();
(3+4)<test | sdf>(x)<A>();

// two comparisons:
(3 + 4) < test | sdf > x;
