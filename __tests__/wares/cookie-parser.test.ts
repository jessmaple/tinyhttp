import { Response, Request } from '../../packages/app/src'
import { cookieParser, JSONCookie, signedCookie, signedCookies } from '../../packages/cookie-parser/src'
import * as signature from '../../packages/cookie-signature/src'
import request from 'supertest'
import http from 'http'

function createServer(secret?: any) {
  const _parser = cookieParser(secret)
  return http.createServer((req: Request, res: Response) => {
    _parser(req, res, (err) => {
      if (err) {
        res.statusCode = 500
        res.end(err.message)
        return
      }

      const cookies = req.url === '/signed' ? req.signedCookies : req.cookies
      res.end(JSON.stringify(cookies))
    })
  })
}

describe('cookieParser()', function () {
  describe('when cookies are sent', function () {
    it('should populate req.cookies', function (done) {
      request(createServer('keyboard cat')).get('/').set('Cookie', 'foo=bar; bar=baz').expect(200, '{"foo":"bar","bar":"baz"}', done)
    })

    it('should inflate JSON cookies', function (done) {
      request(createServer('keyboard cat')).get('/').set('Cookie', 'foo=j:{"foo":"bar"}').expect(200, '{"foo":{"foo":"bar"}}', done)
    })

    it('should not inflate invalid JSON cookies', function (done) {
      request(createServer('keyboard cat')).get('/').set('Cookie', 'foo=j:{"foo":').expect(200, '{"foo":"j:{\\"foo\\":"}', done)
    })
  })

  /*  describe('when req.cookies exists', function () {
    it('should do nothing', function (done) {
      const _parser = cookieParser()
      const server = http.createServer(function (req: Request, res: Response) {
        req.cookies = { fizz: 'buzz' }
        _parser(req, res, function (err) {
          if (err) {
            res.statusCode = 500
            res.end(err.message)
            return
          }

          res.end(JSON.stringify(req.cookies))
        })
      })

      request(server).get('/').set('Cookie', 'foo=bar; bar=baz').expect(200, '{"fizz":"buzz"}', done)
    })
  }) */

  describe('when a secret is given', function () {
    const val = signature.sign('foobarbaz', 'keyboard cat')
    // TODO: "bar" fails...

    it('should populate req.signedCookies', function (done) {
      request(createServer('keyboard cat'))
        .get('/signed')
        .set('Cookie', 'foo=s:' + val)
        .expect(200, '{"foo":"foobarbaz"}', done)
    })

    it('should remove the signed value from req.cookies', function (done) {
      request(createServer('keyboard cat'))
        .get('/')
        .set('Cookie', 'foo=s:' + val)
        .expect(200, '{}', done)
    })

    it('should omit invalid signatures', function (done) {
      const server = createServer('keyboard cat')

      request(server)
        .get('/signed')
        .set('Cookie', 'foo=' + val + '3')
        .expect(200, '{}', function (err) {
          if (err) return done(err)
          request(server)
            .get('/')
            .set('Cookie', 'foo=' + val + '3')
            .expect(200, '{"foo":"foobarbaz.CP7AWaXDfAKIRfH49dQzKJx7sKzzSoPq7/AcBBRVwlI3"}', done)
        })
    })
  })

  describe('when multiple secrets are given', function () {
    it('should populate req.signedCookies', function (done) {
      request(createServer(['keyboard cat', 'nyan cat']))
        .get('/signed')
        .set('Cookie', 'buzz=s:foobar.N5r0C3M8W+IPpzyAJaIddMWbTGfDSO+bfKlZErJ+MeE; fizz=s:foobar.JTCAgiMWsnuZpN3mrYnEUjXlGxmDi4POCBnWbRxse88')
        .expect(200, '{"buzz":"foobar","fizz":"foobar"}', done)
    })
  })

  /*  describe('when no secret is given', function () {
    let server: http.Server

    beforeEach(() => (server = createServer()))

    it('should populate req.cookies', function (done) {
      request(server).get('/').set('Cookie', 'foo=bar; bar=baz').expect(200, '{"foo":"bar","bar":"baz"}', done)
    })

    it('should not populate req.signedCookies', function (done) {
      var val = signature.sign('foobarbaz', 'keyboard cat')
      request(server)
        .get('/signed')
        .set('Cookie', 'foo=s:' + val)
        .expect(200, '{}', done)
    })
  }) */
})

describe('cookieParser.JSONCookie(str)', function () {
  it('should return undefined for non-string arguments', function () {
    expect(JSONCookie()).toStrictEqual(undefined)
    expect(JSONCookie(undefined)).toStrictEqual(undefined)
    expect(JSONCookie(null)).toStrictEqual(undefined)
    expect(JSONCookie(42)).toStrictEqual(undefined)
    expect(JSONCookie({})).toStrictEqual(undefined)
  })

  it('should return undefined for non-JSON cookie string', function () {
    expect(JSONCookie('')).toStrictEqual(undefined)
  })

  it('should return object for JSON cookie string', function () {
    expect(JSONCookie('j:{"foo":"bar"}')).toStrictEqual({ foo: 'bar' })
  })

  it('should return undefined on invalid JSON', function () {
    expect(JSONCookie('j:{foo:"bar"}')).toStrictEqual(undefined)
  })
})

describe('signedCookie(str, secret)', function () {
  it('should return undefined for non-string arguments', function () {
    expect(signedCookie(undefined, 'keyboard cat')).toStrictEqual(undefined)
    expect(signedCookie(null, 'keyboard cat')).toStrictEqual(undefined)
    expect(signedCookie(42, 'keyboard cat')).toStrictEqual(undefined)
    expect(signedCookie({}, 'keyboard cat')).toStrictEqual(undefined)
  })

  it('should pass through non-signed string', function () {
    expect(signedCookie('', 'keyboard cat')).toBe('')
    expect(signedCookie('foo', 'keyboard cat')).toBe('foo')
    expect(signedCookie('j:{}', 'keyboard cat')).toBe('j:{}')
  })

  it('should return false for tampered signed string', function () {
    expect(signedCookie('s:foobaz.N5r0C3M8W+IPpzyAJaIddMWbTGfDSO+bfKlZErJ+MeE', 'keyboard cat')).toBe(false)
  })

  it('should return unsigned value for signed string', function () {
    expect(signedCookie('s:foobar.N5r0C3M8W+IPpzyAJaIddMWbTGfDSO+bfKlZErJ+MeE', 'keyboard cat')).toBe('foobar')
  })

  describe('when secret is an array', function () {
    it('should return false for tampered signed string', function () {
      expect(signedCookie('s:foobaz.N5r0C3M8W+IPpzyAJaIddMWbTGfDSO+bfKlZErJ+MeE', ['keyboard cat', 'nyan cat'])).toBe(false)
    })

    it('should return unsigned value for first secret', function () {
      expect(signedCookie('s:foobar.N5r0C3M8W+IPpzyAJaIddMWbTGfDSO+bfKlZErJ+MeE', ['keyboard cat', 'nyan cat'])).toBe('foobar')
    })

    it('should return unsigned value for second secret', function () {
      expect(signedCookie('s:foobar.JTCAgiMWsnuZpN3mrYnEUjXlGxmDi4POCBnWbRxse88', ['keyboard cat', 'nyan cat'])).toBe('foobar')
    })
  })
})

describe('signedCookies(obj, secret)', function () {
  it('should ignore non-signed strings', function () {
    expect(signedCookies({}, 'keyboard cat')).toEqual({})
    expect(signedCookies({ foo: 'bar' }, 'keyboard cat')).toEqual({})
  })

  it('should include tampered strings as false', function () {
    expect(signedCookies({ foo: 's:foobaz.N5r0C3M8W+IPpzyAJaIddMWbTGfDSO+bfKlZErJ+MeE' }, 'keyboard cat')).toEqual({
      foo: false,
    })
  })

  it('should include unsigned strings', function () {
    expect(signedCookies({ foo: 's:foobar.N5r0C3M8W+IPpzyAJaIddMWbTGfDSO+bfKlZErJ+MeE' }, 'keyboard cat')).toEqual({
      foo: 'foobar',
    })
  })

  it('should remove signed strings from original object', function () {
    const obj = {
      foo: 's:foobar.N5r0C3M8W+IPpzyAJaIddMWbTGfDSO+bfKlZErJ+MeE',
    }

    expect(signedCookies(obj, 'keyboard cat')).toEqual({ foo: 'foobar' })
    expect(obj).toEqual({})
  })

  it('should remove tampered strings from original object', function () {
    const obj = {
      foo: 's:foobaz.N5r0C3M8W+IPpzyAJaIddMWbTGfDSO+bfKlZErJ+MeE',
    }

    expect(signedCookies(obj, 'keyboard cat')).toEqual({ foo: false })
    expect(obj).toEqual({})
  })

  it('should leave unsigned string in original object', function () {
    const obj = {
      fizz: 'buzz',
      foo: 's:foobar.N5r0C3M8W+IPpzyAJaIddMWbTGfDSO+bfKlZErJ+MeE',
    }

    expect(signedCookies(obj, 'keyboard cat')).toEqual({ foo: 'foobar' })
    expect(obj).toEqual({ fizz: 'buzz' })
  })

  describe('when secret is an array', function () {
    it('should include unsigned strings for matching secrets', function () {
      const obj = {
        buzz: 's:foobar.N5r0C3M8W+IPpzyAJaIddMWbTGfDSO+bfKlZErJ+MeE',
        fizz: 's:foobar.JTCAgiMWsnuZpN3mrYnEUjXlGxmDi4POCBnWbRxse88',
      }

      expect(signedCookies(obj, ['keyboard cat'])).toEqual({
        buzz: 'foobar',
        fizz: false,
      })
    })

    it('should include unsigned strings for all secrets', function () {
      const obj = {
        buzz: 's:foobar.N5r0C3M8W+IPpzyAJaIddMWbTGfDSO+bfKlZErJ+MeE',
        fizz: 's:foobar.JTCAgiMWsnuZpN3mrYnEUjXlGxmDi4POCBnWbRxse88',
      }

      expect(signedCookies(obj, ['keyboard cat', 'nyan cat'])).toEqual({
        buzz: 'foobar',
        fizz: 'foobar',
      })
    })
  })
})
